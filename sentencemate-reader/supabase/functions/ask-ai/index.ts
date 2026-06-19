// Edge Function `ask-ai` — Gemini 프록시 (backend_design ① B 전략).
// 흐름(①②⑤ 순서): CORS → JWT 검증 → 일일 쿼터 체크(호출 前) → 마커 조립 →
//   Gemini 호출(시스템프롬프트·키·responseSchema 서버에만, 20s·1회 재시도) →
//   JSON 검증 → 성공 시 카운트++ → v3 JSON 반환.
// 시스템 프롬프트·responseSchema는 클라에 절대 노출 안 됨(B 전략 핵심).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleOptions, json } from "./cors.ts";
import {
  buildUserMessage,
  generationConfig,
  SYSTEM_PROMPT,
} from "./prompt.ts";

// 런타임 자동 주입(SUPABASE_*) + secret(GEMINI_*, AI_DAILY_QUOTA). 하드코딩·VITE_ 금지.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const AI_DAILY_QUOTA = Number(Deno.env.get("AI_DAILY_QUOTA") ?? "100");

// plan_v3 E. ⚠ 배포 테스트에서 모델 거부(404/400)면 여기 한 곳만 교체.
const MODEL = "gemini-3-flash-preview";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_TIMEOUT_MS = 20_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// "오늘"은 UTC 기준 → DB current_date(UTC)와 정합.
const utcToday = () => new Date().toISOString().slice(0, 10);

type Admin = ReturnType<typeof createClient>;

// ai_usage의 count 컬럼(행 수 아님) 조회. 없으면 0.
async function readUsage(admin: Admin, userId: string, today: string) {
  const { data } = await admin
    .from("ai_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .maybeSingle();
  return (data?.count as number | undefined) ?? 0;
}

// Gemini 호출: 5xx/429/네트워크·타임아웃은 0.5s 후 1회 재시도. 그래도 실패 → ok:false(502).
// 형식 오류(텍스트 없음)는 재시도 안 함.
async function callGemini(
  contents: unknown[],
): Promise<{ ok: true; text: string } | { ok: false }> {
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig,
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    try {
      const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text === "string") return { ok: true, text };
        // 200인데 텍스트 없음(차단·빈 응답 등) → 형식오류 취급, 재시도 안 함.
        console.error(
          "gemini: no text in response",
          JSON.stringify(data).slice(0, 500),
        );
        return { ok: false };
      }

      // 항구적 4xx(잘못된 모델 등)는 재시도 무의미 — body 로깅으로 모델 거부를 드러냄.
      const errBody = await res.text();
      console.error(`gemini ${res.status}:`, errBody.slice(0, 500));
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt === 0) {
        await sleep(500);
        continue;
      }
      return { ok: false };
    } catch (e) {
      // 네트워크 오류 또는 타임아웃(abort).
      console.error("gemini fetch error:", String(e));
      if (attempt === 0) {
        await sleep(500);
        continue;
      }
      return { ok: false };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false };
}

Deno.serve(async (req: Request) => {
  // ① CORS 프리플라이트 / 메서드 제한
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return json(req,405, { error: "method_not_allowed" });
  }

  // ② JWT 검증 — 익명 토큰도 통과, 없음/위조만 차단.
  const authHeader = req.headers.get("Authorization");
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader ?? "" } },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return json(req,401, { error: "unauthorized" });

  // ③ 쿼터 체크(호출 前) — service_role 전용(클라는 ai_usage 못 건드림).
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const today = utcToday();
  const used = await readUsage(admin, user.id, today);
  if (used >= AI_DAILY_QUOTA) {
    return json(req,429, { error: "quota_exceeded" }); // Gemini 안 부름
  }

  // ④ body 파싱 + 마커 조립
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req,400, { error: "invalid_body" });
  }
  const {
    bookInfo,
    prev = [],
    selected,
    next = [],
    userRequest,
    history = [],
  } = body as {
    bookInfo?: { title?: string; author?: string };
    prev?: string[];
    selected?: string;
    next?: string[];
    userRequest?: string;
    history?: { role: "user" | "model"; text: string }[];
  };
  // turn-1(history 빔)은 selected 필수, follow-up(history 있음)은 userRequest 필수.
  if (history.length === 0) {
    if (!selected) return json(req,400, { error: "selected_required" });
  } else if (!userRequest) {
    return json(req,400, { error: "user_request_required" });
  }

  // turn-1: buildUserMessage가 마커 조립(서버 단일 출처). follow-up: 마커 재조립 생략,
  //   userRequest(질문)를 그 턴의 user 텍스트로. 어느 쪽이든 userMessage로 echo 반환 →
  //   클라가 history에 그대로 누적(M6 멀티턴).
  const userMessage = history.length > 0
    ? userRequest!
    : buildUserMessage({ bookInfo, prev, selected, next, userRequest });
  // history(M6용, M4엔 보통 []) → 멀티턴 누적. 마지막에 이번 user 메시지.
  const contents = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  // ⑤ Gemini 호출(재시도/타임아웃)
  const result = await callGemini(contents);
  if (!result.ok) return json(req,502, { error: "ai_failed" });

  // ⑥ JSON 형식 검증 — 깨지면 재시도 안 함 → 502.
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    console.error("gemini: invalid JSON", result.text.slice(0, 500));
    return json(req,502, { error: "ai_failed" });
  }

  // ⑦ 카운트 증가(성공 後만) — read-modify-write upsert. ±1 드리프트 허용(폭주 차단엔 무해).
  //    실패한 호출은 위에서 이미 return → 카운트 안 됨.
  try {
    const cur = await readUsage(admin, user.id, today);
    await admin
      .from("ai_usage")
      .upsert(
        { user_id: user.id, usage_date: today, count: cur + 1 },
        { onConflict: "user_id,usage_date" },
      );
  } catch (e) {
    // 카운트 실패가 응답을 막지는 않음(이미 성공한 호출). 로깅만.
    console.error("ai_usage upsert failed:", String(e));
  }

  // ⑧ v3 JSON + userMessage echo 반환 (M6: 클라가 history 누적용으로 그대로 보관).
  return json(req,200, { answer: parsed, userMessage });
});

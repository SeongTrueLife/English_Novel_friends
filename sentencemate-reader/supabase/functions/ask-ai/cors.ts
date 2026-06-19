// CORS — backend_design 보안표 #5(아무 사이트나 함수 호출 차단). 허용 origin 제한(다중).
// Access-Control-Allow-Origin은 단일 값만 가능 → 요청 Origin이 허용목록에 있으면 그 값을 echo.
// 새 배포 도메인 생기면 여기 ALLOWED_ORIGINS에 추가.
const ALLOWED_ORIGINS = [
  "http://localhost:5173", // Vite dev
  "https://english-novel-friends.vercel.app", // Vercel 프로덕션
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin", // origin echo 시 캐시 정합
  };
}

// 프리플라이트(OPTIONS)는 Authorization 헤더 없이 오므로 본 검증 전에 처리.
export function handleOptions(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

// 모든 응답(성공·에러)에 CORS 헤더를 병합하는 JSON 헬퍼. 요청별 origin echo를 위해 req를 받는다.
export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

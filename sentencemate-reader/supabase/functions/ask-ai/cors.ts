// CORS — backend_design 보안표 #5(아무 사이트나 함수 호출 차단). 허용 origin 제한.
// 배포 도메인은 나중에 추가(지금은 Vite dev 서버만).
const ALLOW_ORIGIN = "http://localhost:5173";

export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 프리플라이트(OPTIONS)는 Authorization 헤더 없이 오므로 본 검증 전에 처리.
export function handleOptions(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders });
}

// 모든 응답(성공·에러)에 CORS 헤더를 병합하는 JSON 헬퍼.
export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

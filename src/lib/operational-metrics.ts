/**
 * korea-finance-mcp — 운영 메트릭 모듈
 *
 * 도구 호출 패턴 추적·운영 통계용. 익명 (사용자 식별 정보 미수집).
 * 환경변수 `OPERATIONAL_METRICS_ENABLED=true` 시점부터 작동. 기본 비활성.
 *
 * @internal v1.2부터 활성. PRIVACY.md §1 "자동 수집 정보" 카테고리.
 */

import { createHash } from "node:crypto";

const ENABLED = process.env.OPERATIONAL_METRICS_ENABLED === "true";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export interface ToolCallEvent {
  /** 도구명 (예: "get_indicator") */
  tool_name: string;
  /** 입력 키워드 — 공개 정보만 (종목명·지표 코드·지역 코드 등). 사용자 식별 정보 X */
  input_keywords: string[];
  /** 결과 코드 — "OK" / "INFO-200" / "ERROR_*" */
  result_code: string;
  /** 응답 시간 (ms) */
  response_time_ms: number;
  /** 익명 세션 해시 — 동선(호출 순서) 분석용. 원본 세션ID는 SHA-256 후 폐기, 개인 매핑 0 */
  session_hash?: string;
  /** MCP 클라이언트 종류 (user-agent 파생, 공개 정보) — AI 채널 식별용 */
  client_type?: string;
  /** 결과 건수 — 풍부도(0건=수요 있는데 데이터 공백 신호). 응답 본문은 미저장, 개수만 */
  result_count?: number;
}

/**
 * 도구 호출 이벤트 기록. ENABLED=false 또는 Supabase 미설정 시 no-op.
 * 실패 시 silently swallow (서비스 가용성 우선).
 */
export async function recordToolCall(event: ToolCallEvent): Promise<void> {
  if (!ENABLED || !SUPABASE_URL || !SUPABASE_KEY) {
    return; // 비활성 상태에서는 no-op
  }

  try {
    const payload = {
      tool_name: event.tool_name,
      input_hash: hashKeywords(event.input_keywords),
      input_keywords: event.input_keywords,
      result_code: event.result_code,
      response_time_ms: event.response_time_ms,
      session_hash: event.session_hash ?? null,
      client_type: event.client_type ?? null,
      result_count: event.result_count ?? null,
      created_at: new Date().toISOString(),
    };

    await fetch(`${SUPABASE_URL}/rest/v1/kfin_tool_calls`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // 메트릭 실패는 서비스 가용성에 영향 0 — silent
    process.stderr.write(`[metrics] swallow: ${String(err).slice(0, 80)}\n`);
  }
}

/**
 * SHA-256(입력 키워드 결합). 16자 truncate (역추적 불가).
 */
function hashKeywords(keywords: string[]): string {
  return createHash("sha256")
    .update(keywords.join("|"))
    .digest("hex")
    .slice(0, 16);
}

/**
 * 익명 세션 해시 — 원본 세션ID를 SHA-256 후 16자 truncate.
 * 같은 세션 내 호출은 동일 해시(동선 연결 가능), 원본 역추적 불가, 개인 매핑 0.
 */
function hashSession(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex").slice(0, 16);
}

/**
 * 결과 건수 추출 (풍부도). 응답 *본문*은 저장하지 않고 개수만.
 * 배열 길이 / meta.total_trades_matched / data·series 길이 휴리스틱. 불명 시 undefined.
 */
function countResults(r: unknown): number | undefined {
  if (Array.isArray(r)) return r.length;
  if (r && typeof r === "object") {
    const o = r as Record<string, unknown>;
    const m = o.meta as Record<string, unknown> | undefined;
    if (m && typeof m.total_trades_matched === "number") return m.total_trades_matched;
    if (Array.isArray(o.data)) return o.data.length;
    if (Array.isArray(o.series)) return o.series.length;
    if (Array.isArray(o.results)) return o.results.length;
  }
  return undefined;
}

/**
 * 도구 실행 래퍼 — 메트릭 자동 기록 + 실행 시간 측정.
 *
 * @example
 *   const result = await withMetrics(
 *     "get_indicator",
 *     [input.indicator_code ?? "?"],
 *     () => executeGetIndicator(input),
 *   );
 */
export async function withMetrics<T>(
  toolName: string,
  inputKeywords: string[],
  exec: () => Promise<T>,
  meta?: { sessionId?: string; clientType?: string },
): Promise<T> {
  const start = Date.now();
  const session_hash = meta?.sessionId ? hashSession(meta.sessionId) : undefined;
  const client_type = meta?.clientType;
  try {
    const result = await exec();
    void recordToolCall({
      tool_name: toolName,
      input_keywords: inputKeywords,
      result_code: "OK",
      response_time_ms: Date.now() - start,
      session_hash,
      client_type,
      result_count: countResults(result),
    });
    return result;
  } catch (err) {
    void recordToolCall({
      tool_name: toolName,
      input_keywords: inputKeywords,
      result_code: `ERROR_${String(err).slice(0, 40)}`,
      response_time_ms: Date.now() - start,
      session_hash,
      client_type,
    });
    throw err;
  }
}

/**
 * 현재 모듈 활성 여부 (디버깅용).
 */
export function isMetricsEnabled(): boolean {
  return ENABLED && Boolean(SUPABASE_URL) && Boolean(SUPABASE_KEY);
}

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
): Promise<T> {
  const start = Date.now();
  try {
    const result = await exec();
    void recordToolCall({
      tool_name: toolName,
      input_keywords: inputKeywords,
      result_code: "OK",
      response_time_ms: Date.now() - start,
    });
    return result;
  } catch (err) {
    void recordToolCall({
      tool_name: toolName,
      input_keywords: inputKeywords,
      result_code: `ERROR_${String(err).slice(0, 40)}`,
      response_time_ms: Date.now() - start,
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

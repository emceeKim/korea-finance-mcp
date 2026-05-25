/**
 * korea-finance-mcp — 표준 응답 빌더
 *
 * 환각 방지 양보 불가 원칙을 코드로 강제하는 핵심 모듈.
 * 모든 도구는 반드시 `buildResponse()` 또는 `buildNoData()`로 응답해야 한다.
 *
 * @see CONTRIBUTING.md §환각 방지 5규칙
 */

import type { ToolResponse, NoDataResponse } from "../types.js";

/**
 * 표준 면책조항 — 모든 응답에 자동 부착.
 *
 * 자본시장법·환각 방지 양 측면에서 양보 불가 텍스트.
 * 도구 코드에서 절대 수정·생략 금지.
 *
 * v0.2 강화 (2026-05-25, 변호사 자문 생략 대체 모드):
 *   - 자본시장법상 미등록 사업자 명시 (투자중개·자문·일임업)
 *   - "투자 자문·권유·추천이 아님" 명시 (3종 모두 부정)
 *   - 전문가 위임 안내 (법률·세무·투자)
 *   - 공식 사이트 확인 권장 (기존 유지)
 */
export const STANDARD_DISCLAIMER =
  "본 정보는 한국은행 ECOS·국토부·DART·KRX 등 공공 데이터 조회 서비스이며, " +
  "투자 자문·권유·추천이 아닙니다. " +
  "본 서비스 운영자는 자본시장법상 투자중개업·투자자문업·유사투자자문업·투자일임업 중 " +
  "어느 것에도 등록된 사업자가 아닙니다. " +
  "모든 투자·재무 판단과 그에 따른 손익은 사용자 본인의 책임입니다. " +
  "법률·세무·투자 자문이 필요하시면 자격을 갖춘 전문가에게 문의하십시오. " +
  "공식 사이트에서 최종 확인을 권장합니다.";

/**
 * 표준 응답을 빌드한다. 면책조항은 자동 부착.
 *
 * @example
 * return buildResponse({
 *   source: "한국은행 ECOS API",
 *   source_url: "https://ecos.bok.or.kr/api/",
 *   last_updated_at: apiResponse.lastUpdated,
 *   data: { value: 3.5, unit: "%" },
 * });
 */
export function buildResponse<T>(
  input: Omit<ToolResponse<T>, "disclaimer">,
): ToolResponse<T> {
  // 양보 불가 검증 — 빈 source/url/date는 코드에서 즉시 차단
  if (!input.source || input.source.trim() === "") {
    throw new Error(
      "[buildResponse] source가 비어 있음. 모든 응답은 출처를 명시해야 함.",
    );
  }
  if (!input.source_url || !input.source_url.startsWith("http")) {
    throw new Error(
      "[buildResponse] source_url이 유효하지 않음. http(s)로 시작해야 함.",
    );
  }
  if (!input.last_updated_at) {
    throw new Error(
      "[buildResponse] last_updated_at이 비어 있음. 추측 금지, API 응답값을 그대로 사용.",
    );
  }

  return {
    ...input,
    disclaimer: STANDARD_DISCLAIMER,
  };
}

/**
 * "데이터 없음" 응답. 추측·일반화·보간 금지 원칙의 코드화.
 *
 * @example
 * if (!result) return buildNoData({
 *   source: "한국은행 ECOS API",
 *   source_url: "https://ecos.bok.or.kr/api/",
 *   last_updated_at: new Date().toISOString(),
 * });
 */
export function buildNoData(input: {
  source: string;
  source_url: string;
  last_updated_at: string;
  /**
   * WO-097 (2026-05-25): 도구별 상황 안내 (선택). 기본 메시지 *앞*에 추가됨.
   * 예: get_disclosure가 KNOWN_COMPANIES 미매핑 시 "..."  메시지 전달.
   * 이전엔 무시되던 암묵적 버그 — 회귀 st-02b/st-02c/st-04c 발견.
   */
  warnings?: string[];
}): NoDataResponse {
  const baseWarning = "데이터 없음 — 추측하지 않음. 공식 사이트에서 직접 확인 권장.";
  const extra = input.warnings && input.warnings.length > 0 ? input.warnings : [];
  return {
    source: input.source,
    source_url: input.source_url,
    last_updated_at: input.last_updated_at,
    data: null,
    disclaimer: STANDARD_DISCLAIMER,
    warnings: [...extra, baseWarning],
  };
}

/**
 * 응답을 MCP 표준 텍스트 콘텐츠로 직렬화.
 *
 * MCP SDK의 `CallToolResult.content[]` 형태로 변환한다.
 * JSON 직렬화 + 면책조항·출처 가독성 헤더 자동 부착.
 */
export function serializeForMcp<T>(response: ToolResponse<T>): {
  content: Array<{ type: "text"; text: string }>;
} {
  const header = [
    `📊 출처: ${response.source}`,
    `🔗 ${response.source_url}`,
    `📅 기준일: ${response.last_updated_at}`,
    response.warnings && response.warnings.length > 0
      ? `\n⚠️ ${response.warnings.join("\n⚠️ ")}\n`
      : "",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const body = response.data !== null
    ? JSON.stringify(response.data, null, 2)
    : "(데이터 없음)";

  const footer = `\n\n---\n${response.disclaimer}`;

  return {
    content: [
      {
        type: "text",
        text: header + body + footer,
      },
    ],
  };
}

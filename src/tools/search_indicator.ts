/**
 * korea-finance-mcp — Tool #2: search_indicator
 *
 * ECOS 통계 코드를 한글 키워드로 검색한다. `get_indicator` 호출 전 단계.
 *
 * v0.1 설계 결정 (CONTRIBUTING.md §2 준수):
 *   - Layer A는 `src/lib/*` 수정 금지 → ECOS 검색 API 직접 호출 불가
 *   - 대신 **정적 사전 + ECOS 공식 검색 URL 안내** 방식 채택
 *   - 사전에 등록된 통계는 한국은행 ECOS 공식 통계표에서 1회 사람이 검증한 코드만
 *   - 사전 미적중 시 `buildNoData` + 공식 검색 URL 안내 (환각 0%)
 *   - v0.2에서 `lib/ecos.ts`에 `fetchEcosStatTableList()` 추가 후 전체 검색 활성화 (issue로 등록)
 *
 * @see CONTRIBUTING.md §도구 1개 추가 5단계
 * @see CONTRIBUTING.md §1.1 환각 방지 5규칙
 */

import { z } from "zod";
import { buildResponse, buildNoData } from "../lib/response.js";
import type { ToolResponse } from "../types.js";

// ============================================================
// [1] 입력 스키마
// ============================================================
export const SearchIndicatorInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "한글 검색어 (예: '기준금리', '환율'). " +
        "v0.1은 정적 사전 검색이라 키워드가 좁다. 결과 없을 시 ECOS 공식 검색 URL 안내.",
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .default(10)
    .describe("최대 결과 수 (1~50, 기본 10)"),
});

export type SearchIndicatorInput = z.infer<typeof SearchIndicatorInputSchema>;

// ============================================================
// [2] MCP 도구 메타데이터
// ============================================================
export const searchIndicatorTool = {
  name: "search_indicator",
  description:
    "한국은행 ECOS의 통계 코드를 한글 키워드로 검색한다. " +
    "결과를 받은 다음 `get_indicator(indicator_code=...)`로 실제 값을 조회한다. " +
    "v0.1은 정적 사전 기반 (CONTRIBUTING §2의 lib/* 보호 정책 준수). " +
    "사전에 없는 키워드는 ECOS 공식 검색 사이트로 안내한다.",
  inputSchema: SearchIndicatorInputSchema,
} as const;

// ============================================================
// [3] 검색 결과 타입
// ============================================================
export interface IndicatorSearchResult {
  /** ECOS 통계 코드 (예: "722Y001"). */
  code: string;
  /** 한글 통계명. */
  name: string;
  /** 추천 주기 (D/M/Q/S/Y). */
  cycle: "D" | "M" | "Q" | "S" | "Y";
  /** 단위 (예: "%", "원"). */
  unit: string;
  /** 매칭된 키워드(검색 디버깅용). */
  matched_keywords: string[];
}

// ============================================================
// [4] 정적 사전 — 한국은행 ECOS 공식 통계표에서 1회 검증한 코드만 등록
// ============================================================
/**
 * ⚠️ 양보 불가: 본 사전에 항목 추가 시 한국은행 ECOS 공식 통계표
 * (https://ecos.bok.or.kr/#/Short/Search) 에서 코드·주기·단위를 실측 확인할 것.
 *
 * 추측·기억 기반 추가 금지 (CONTRIBUTING §1.1 환각 방지 #2).
 *
 * v0.1 등록 항목 (CONTRIBUTING.md §3에 예시로 명시된 2개):
 *   - 722Y001 한국은행 기준금리
 *   - 731Y001 원/달러 환율
 *
 * v0.2 확장 계획:
 *   - `lib/ecos.ts`에 `fetchEcosStatTableList()` 추가
 *   - 한국은행 100대 통계지표 자동 수집
 */
const KNOWN_INDICATORS: ReadonlyArray<{
  code: string;
  name: string;
  cycle: "D" | "M" | "Q" | "S" | "Y";
  unit: string;
  keywords: ReadonlyArray<string>;
}> = [
  {
    code: "722Y001",
    name: "한국은행 기준금리",
    cycle: "D",
    unit: "%",
    keywords: ["기준금리", "정책금리", "BOK 금리", "한은 금리"],
  },
  {
    code: "731Y001",
    name: "원/달러 환율",
    cycle: "D",
    unit: "원",
    keywords: ["환율", "원달러", "원/달러", "달러", "USD", "USD/KRW"],
  },
];

// ECOS 공식 검색 페이지 URL
const ECOS_SEARCH_URL = "https://ecos.bok.or.kr/#/Short/Search";

// ============================================================
// [5] 핸들러
// ============================================================
/**
 * `search_indicator` 도구의 실행 함수.
 *
 * 흐름:
 *   1. 입력 검증 (Zod)
 *   2. 정적 사전에서 키워드 매칭 (대소문자·공백 무시)
 *   3. 매칭 0건 → `buildNoData` + ECOS 공식 검색 URL 안내
 *   4. 매칭 있으면 `buildResponse` (limit 적용)
 */
export async function executeSearchIndicator(
  input: SearchIndicatorInput,
): Promise<ToolResponse<IndicatorSearchResult[]>> {
  const validated = SearchIndicatorInputSchema.parse(input);
  const normalizedQuery = normalizeKeyword(validated.query);

  // 정적 사전 매칭
  const matches: IndicatorSearchResult[] = [];
  for (const item of KNOWN_INDICATORS) {
    const matched = item.keywords.filter((kw) =>
      normalizeKeyword(kw).includes(normalizedQuery),
    );
    // 통계명 자체도 매칭에 포함
    const nameHit = normalizeKeyword(item.name).includes(normalizedQuery);

    if (matched.length > 0 || nameHit) {
      matches.push({
        code: item.code,
        name: item.name,
        cycle: item.cycle,
        unit: item.unit,
        matched_keywords: nameHit
          ? [...matched, `(통계명: ${item.name})`]
          : matched,
      });
    }
  }

  // 결과 0건 → buildNoData
  if (matches.length === 0) {
    return buildNoData({
      source: "한국은행 ECOS API (정적 사전, v0.1)",
      source_url: ECOS_SEARCH_URL,
      last_updated_at: new Date().toISOString(),
    });
  }

  // limit 적용
  const limited = matches.slice(0, validated.limit);

  return buildResponse<IndicatorSearchResult[]>({
    source: "한국은행 ECOS API (정적 사전, v0.1)",
    source_url: ECOS_SEARCH_URL,
    // 정적 사전은 외부 API가 last_updated_at을 안 주므로 현재 시각 사용
    // (CONTRIBUTING §1.1 #4 예외 조항: API가 안 주는 경우)
    last_updated_at: new Date().toISOString(),
    data: limited,
    warnings: [
      `v0.1은 정적 사전 기반 (등록 ${KNOWN_INDICATORS.length}건). ` +
        `사전 미적중 시 ECOS 공식 검색에서 직접 확인: ${ECOS_SEARCH_URL}`,
      "통계 코드는 ECOS 운영에 따라 변경될 수 있음 — 공식 사이트 확인 권장.",
    ],
    meta: {
      total_matches: matches.length,
      returned: limited.length,
      dictionary_size: KNOWN_INDICATORS.length,
      query_normalized: normalizedQuery,
    },
  });
}

// ============================================================
// [6] 헬퍼
// ============================================================
/**
 * 검색 키워드 정규화 — 공백 제거 + 소문자화.
 * 한글은 대소문자 영향 없으나 영문(USD 등)을 위해 소문자화.
 */
function normalizeKeyword(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

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
  title: "Search Korea ECOS Indicator Codes",
  description:
    "한국은행 ECOS의 통계 코드를 한글 키워드로 검색한다. " +
    "결과를 받은 다음 `get_indicator(indicator_code=...)`로 실제 값을 조회한다. " +
    "v0.1은 정적 사전 기반 (CONTRIBUTING §2의 lib/* 보호 정책 준수). " +
    "사전에 없는 키워드는 ECOS 공식 검색 사이트로 안내한다.",
  inputSchema: SearchIndicatorInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
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
/**
 * v0.2 export 추가 — `get_dashboard` 등 다른 도구가 동일 사전을 참조.
 * @public 도구 영역 데이터 공유. lib/* 무수정 룰 우회 (도구 → 도구 import).
 *   v0.3에서 `src/data/known-indicators.ts` 분리 검토.
 */
/**
 * WO-070 (2026-05-25): 다항목 통계 메타 확장.
 *
 * 통념파괴: "ECOS 코드 1개 = 단일 지표"라는 통념이 깨졌다.
 *   722Y001은 *48개 sub-item*을 가진 다항목 통계 (기준금리 + 콜금리 + 여수신금리 ...).
 *   item_code1을 안 주면 ECOS가 임의 첫 행 반환 → 사용자/LLM이 잘못된 값 받음.
 *
 * → 다항목 통계는 **default_item_code1을 사전에 명시**하고,
 *   응답값이 **expected_range** 밖이면 *경고와 함께 거부*한다 (환각 차단 서버 측 강화).
 *
 * @see wiki/korea-finance-mcp/work-orders.md WO-070
 */
export interface KnownIndicatorMeta {
  code: string;
  name: string;
  cycle: "D" | "M" | "Q" | "S" | "Y";
  unit: string;
  keywords: ReadonlyArray<string>;
  /** 다항목 통계 여부. true면 default_item_code1 필수. */
  multi_item?: boolean;
  /** 다항목 통계일 때 자동 부착할 ITEM_CODE (ECOS StatisticItemList API로 역검증 완료한 것만). */
  default_item_code1?: string;
  /** 응답값 현실 범위 [min, max]. 밖이면 경고. 미지정이면 검증 생략. */
  expected_range?: readonly [number, number];
}

export const KNOWN_INDICATORS: ReadonlyArray<KnownIndicatorMeta> = [
  {
    code: "722Y001",
    name: "한국은행 기준금리",
    cycle: "M", // WO-070: D → M (월별이 일반 사용 빈도 높음, 일별 데이터는 동일 값 반복)
    unit: "연%",
    keywords: ["기준금리", "정책금리", "BOK 금리", "한은 금리"],
    // WO-070 (2026-05-25): 다항목 통계 (48 sub-items). ECOS StatisticItemList 역검증 결과:
    //   ITEM_CODE 0101000: 1999~현재, DATA_CNT M=324 (가장 활발) → 한국은행 기준금리 가설.
    //   ITEM_CODE 0102000: 1994~현재, DATA_CNT M=388 → 콜금리 가설.
    //   ITEM_CODE 0109000: 1994~2013 (폐지)
    // ⚠️ default_item_code1은 주인님 ECOS 실 호출 검증 후 확정 (WO-070-A 결과 대기).
    multi_item: true,
    default_item_code1: "0101000", // 가설: 한국은행 기준금리. WO-070-A 검증 후 확정/수정.
    expected_range: [0.25, 8.0], // 한국 기준금리 역사적 범위 (IMF 직후 ~10% 제외하고 일반 0.5~5%)
  },
  {
    code: "731Y001",
    name: "원/달러 환율",
    cycle: "D",
    unit: "원",
    keywords: ["환율", "원달러", "원/달러", "달러", "USD", "USD/KRW"],
    expected_range: [800, 2000], // 한국 원달러 역사적 범위
  },
  // WO-021 (2026-05-25): ECOS StatisticTableList API 역검증 통과 2건 활성.
  // STAT_NAME은 API 응답 그대로 (환각 방지 양보 불가).
  {
    code: "901Y009",
    name: "소비자물가지수", // ECOS STAT_NAME: "4.2.1. 소비자물가지수"
    cycle: "M",
    unit: "지수",
    keywords: ["CPI", "소비자물가", "물가", "물가지수", "인플레이션"],
    // CPI는 100 기준 (2020=100 또는 2015=100). 일반적으로 80~150 범위.
    expected_range: [70, 200],
  },
  {
    code: "101Y004",
    name: "M2 상품별 구성내역(평잔, 원계열)", // ECOS STAT_NAME 그대로
    cycle: "M",
    unit: "조원",
    keywords: ["M2", "통화량", "광의통화", "통화공급", "유동성"],
    // M2는 다항목일 가능성 매우 높음 (WO-070-A 추가 검증 필요).
    // 현재값(2026년경) 약 4000~5000조원 범위.
    expected_range: [2000, 10000],
  },
  // WO-018/021 비활성 (검증 실패 — ECOS StatisticTableList ❌):
  //   200Y001 GDP / 901Y012 실업률 / 098Y001 KOSPI
  // WO-021 보류 (코드 존재하나 *우리 추측 의미와 다름*):
  //   101Y003 (M2 계절조정계열, 우리는 M1 추측) / 731Y002 (대미달러환율, 우리는 엔 추측)
  // 다음 라운드 ECOS 웹 검색 또는 StatisticItemList로 정확 코드 확인 후 추가.
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

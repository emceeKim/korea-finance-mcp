/**
 * get_realestate_price — 국토부 실거래가 조회 (v2.0 첫 도구)
 *
 * @see wiki/korea-finance-mcp/tools-spec.md §2.1
 * @see wiki/decisions/korea-finance-mcp-realestate-data-policy-2026-W22.md
 *
 * 양보 불가 (회귀 re-08~13):
 * - dong/ho/jibun 자동 제거 (sanitizeTrade 강제)
 * - KNOWN_REGIONS 정적 사전만 (re-16)
 * - property_type enum 검증 (re-11)
 * - INFO-200 부분 성공 (re-13)
 */

import { z } from "zod";
import { buildResponse, buildNoData } from "../lib/response.js";
import {
  fetchRtmsTrades,
  KNOWN_REGIONS,
  RTMS_ENDPOINTS,
  type RealEstateTrade,
  type PropertyType,
} from "../lib/realestate.js";

export const GetRealEstatePriceInputSchema = z.object({
  region_code: z.string().regex(/^\d{5}$/, "region_code는 5자리 법정동코드 (예: 11680 강남구)"),
  year_month: z.string().regex(/^\d{6}$/, "year_month는 YYYYMM 형식 (예: 202405)"),
  property_type: z.enum(["apt", "villa", "house"]).optional().default("apt"),
});

export type GetRealEstatePriceInput = z.infer<typeof GetRealEstatePriceInputSchema>;

export const getRealEstatePriceTool = {
  name: "get_realestate_price",
  title: "Korea Real Estate Transaction Price (RTMS)",
  description: [
    "한국 부동산 실거래가 조회 (국토부 RTMS).",
    "입력: region_code (5자리 법정동, KNOWN_REGIONS 사전 매핑 필수)",
    "      year_month (YYYYMM)",
    "      property_type (apt|villa|house, default apt)",
    "출력: 단지명·면적·가격·거래일·층 (⚠️ 동·호수·지번 자동 제거)",
    "데이터 출처: data.go.kr (공공 무료, 영업일 +30~60일 신고 의무)",
  ].join("\n"),
  inputSchema: GetRealEstatePriceInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
} as const;

interface RealEstateMeta {
  region_code: string;
  region_name: string;
  year_month: string;
  property_type: PropertyType;
  data_count: number;
  data_lag_note: string;
}

export async function executeGetRealEstatePrice(input: GetRealEstatePriceInput) {
  // v1.2 (WO-118): KNOWN_REGIONS 강제 검증 제거 — 5자리 형식만 검증 (validateRegionCode).
  //   미등록 코드는 RTMS API에 위임 → 빈 응답 시 INFO-200 fallback (정부 RTMS 수준 정렬).
  //   regionMeta 없으면 region_name fallback 사용 ("법정동 코드 {code}").
  const regionMeta = KNOWN_REGIONS[input.region_code];
  const propType = input.property_type ?? "apt";
  const sourceUrl = RTMS_ENDPOINTS[propType];

  const warnings: string[] = [];
  let trades: RealEstateTrade[] = [];

  try {
    trades = await fetchRtmsTrades({
      property_type: propType,
      region_code: input.region_code,
      year_month: input.year_month,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // INFO-200 패턴 — 부분 성공 (회귀 re-13)
    if (/INFO-200|해당하는 데이터가 없습니다|no data/i.test(message)) {
      warnings.push(`해당 조건의 거래 없음: ${message}`);
      trades = [];
    } else {
      throw err; // 다른 에러 전파 (WO-024 패턴)
    }
  }

  const lastUpdatedAt = new Date().toISOString();

  if (trades.length === 0) {
    return buildNoData({
      source: "국토교통부 RTMS (실거래가 공개시스템)",
      source_url: sourceUrl,
      last_updated_at: lastUpdatedAt,
    });
  }

  const meta: RealEstateMeta = {
    region_code: input.region_code,
    region_name: regionMeta?.name_ko ?? `법정동 코드 ${input.region_code}`,
    year_month: input.year_month,
    property_type: propType,
    data_count: trades.length,
    data_lag_note:
      "RTMS는 거래일로부터 30~60일 후 신고 의무 — 최근 1~2개월은 자료 누락 多",
  };

  return buildResponse({
    source: "국토교통부 RTMS (실거래가 공개시스템)",
    source_url: sourceUrl,
    last_updated_at: lastUpdatedAt,
    data: { meta, trades, warnings },
  });
}

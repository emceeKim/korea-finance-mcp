/**
 * get_housing_index — 한국부동산원 주택가격지수 조회 (v2.0 두 번째 도구)
 *
 * @see wiki/korea-finance-mcp/tools-spec.md §2.2
 * @see wiki/korea-finance-mcp/realestate-api-research.md §2
 *
 * 양보 불가 (회귀 re-14, re-16):
 * - KNOWN_REGIONS_RONE 정적 사전만 (re-16)
 * - INFO-200 catch (부분 성공)
 * - 추측 금지 (WO-018)
 */

import { z } from "zod";
import { buildResponse, buildNoData } from "../lib/response.js";
import {
  fetchRoneSeries,
  KNOWN_REGIONS_RONE,
  RONE_BASE_URL,
  type RoneRegion,
  type RonePoint,
} from "../lib/rone.js";

export const GetHousingIndexInputSchema = z.object({
  region: z.string().describe("KNOWN_REGIONS_RONE alias (national/seoul/gangnam/seocho/songpa/incheon/busan/daegu/sejong)"),
  start_period: z.string().regex(/^\d{6}$/, "start_period는 YYYYMM (예: 202001)"),
  end_period: z.string().regex(/^\d{6}$/, "end_period는 YYYYMM (예: 202412)"),
});

export type GetHousingIndexInput = z.infer<typeof GetHousingIndexInputSchema>;

export const getHousingIndexTool = {
  name: "get_housing_index",
  title: "Korea Housing Price Index (R-ONE Monthly)",
  description: [
    "한국 주택가격지수 (월간, 한국부동산원 R-ONE).",
    "입력: region (national/seoul/gangnam/seocho/songpa/incheon/busan/daegu/sejong)",
    "      start_period / end_period (YYYYMM)",
    "출력: 월별 시계열 (지수, 2020=100 기준)",
    "데이터 출처: reb.or.kr (공공 무료, 월말 +15일 발표)",
  ].join("\n"),
  inputSchema: GetHousingIndexInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
} as const;

interface HousingIndexMeta {
  region: string;
  region_name_ko: string;
  start_period: string;
  end_period: string;
  data_count: number;
  data_lag_note: string;
}

export async function executeGetHousingIndex(input: GetHousingIndexInput) {
  // KNOWN_REGIONS_RONE 사전 매핑 검증 (re-16)
  if (!(input.region in KNOWN_REGIONS_RONE)) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["region"],
        message: `미등록 region: ${input.region}. KNOWN_REGIONS_RONE (${Object.keys(KNOWN_REGIONS_RONE).length}건) 사전 매핑 통과만 허용. 추측 금지 (WO-018).`,
      },
    ]);
  }

  const region = input.region as RoneRegion;
  const regionMeta = KNOWN_REGIONS_RONE[region]!;
  const warnings: string[] = [];
  let points: RonePoint[] = [];

  try {
    points = await fetchRoneSeries({
      stat_code: "housing_index_apt_monthly",
      region,
      start_period: input.start_period,
      end_period: input.end_period,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // INFO-200 패턴 (부분 성공)
    if (/INFO-200|해당하는 데이터가 없습니다|no data/i.test(message)) {
      warnings.push(`해당 조건의 시계열 없음: ${message}`);
      points = [];
    } else {
      throw err; // 다른 에러 전파 (WO-024)
    }
  }

  const lastUpdatedAt = new Date().toISOString();

  if (points.length === 0) {
    return buildNoData({
      source: "한국부동산원 R-ONE (월간 매매가격지수_아파트)",
      source_url: RONE_BASE_URL,
      last_updated_at: lastUpdatedAt,
    });
  }

  const meta: HousingIndexMeta = {
    region,
    region_name_ko: regionMeta.name_ko,
    start_period: input.start_period,
    end_period: input.end_period,
    data_count: points.length,
    data_lag_note: "R-ONE 월간 발표 — 매월 15일 전후 전월 데이터 갱신",
  };

  return buildResponse({
    source: "한국부동산원 R-ONE (월간 매매가격지수_아파트)",
    source_url: RONE_BASE_URL,
    last_updated_at: lastUpdatedAt,
    data: { meta, points, warnings },
  });
}

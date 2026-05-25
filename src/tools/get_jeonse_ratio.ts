/**
 * get_jeonse_ratio — 한국 전세가율 조회 (v2.0 세 번째 도구)
 *
 * @see wiki/korea-finance-mcp/tools-spec.md §2.3
 * @see wiki/decisions/korea-finance-mcp-realestate-data-policy-2026-W22.md
 *
 * 양보 불가 (회귀 re-15, re-16):
 * - KNOWN_REGIONS_RONE 정적 사전만 (re-16)
 * - INFO-200 catch (부분 성공)
 * - "예측·전망" 키워드 0건
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

export const GetJeonseRatioInputSchema = z.object({
  region: z.string().describe("KNOWN_REGIONS_RONE alias"),
  start_period: z.string().regex(/^\d{6}$/, "start_period는 YYYYMM"),
  end_period: z.string().regex(/^\d{6}$/, "end_period는 YYYYMM"),
});

export type GetJeonseRatioInput = z.infer<typeof GetJeonseRatioInputSchema>;

export const getJeonseRatioTool = {
  name: "get_jeonse_ratio",
  title: "Korea Jeonse-to-Sale Ratio (R-ONE, Korea-specific)",
  description: [
    "한국 전세가율 (매매가격 대비 전세가격 비율, 월별, 한국부동산원 R-ONE).",
    "입력: region (national/seoul/gangnam/seocho/songpa/incheon/busan/daegu/sejong)",
    "      start_period / end_period (YYYYMM)",
    "출력: 월별 시계열 (%, 0~100)",
    "한국 특화 지표 — 외국 MCP 진입 어려움 (방벽 2)",
  ].join("\n"),
  inputSchema: GetJeonseRatioInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
} as const;

interface JeonseMeta {
  region: string;
  region_name_ko: string;
  start_period: string;
  end_period: string;
  data_count: number;
  trend_3m_pp?: number; // 최근 3개월 변화 (percentage points)
}

export async function executeGetJeonseRatio(input: GetJeonseRatioInput) {
  if (!(input.region in KNOWN_REGIONS_RONE)) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["region"],
        message: `미등록 region: ${input.region}. KNOWN_REGIONS_RONE (${Object.keys(KNOWN_REGIONS_RONE).length}건) 사전 매핑만 허용. 추측 금지 (WO-018).`,
      },
    ]);
  }

  const region = input.region as RoneRegion;
  const regionMeta = KNOWN_REGIONS_RONE[region]!;
  const warnings: string[] = [];
  let points: RonePoint[] = [];

  try {
    points = await fetchRoneSeries({
      stat_code: "jeonse_ratio_monthly",
      region,
      start_period: input.start_period,
      end_period: input.end_period,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/INFO-200|해당하는 데이터가 없습니다|no data/i.test(message)) {
      warnings.push(`해당 조건의 시계열 없음: ${message}`);
      points = [];
    } else {
      throw err;
    }
  }

  const lastUpdatedAt = new Date().toISOString();

  if (points.length === 0) {
    return buildNoData({
      source: "한국부동산원 R-ONE (매매가격대비 전세가격 비율)",
      source_url: RONE_BASE_URL,
      last_updated_at: lastUpdatedAt,
    });
  }

  // trend_3m_pp 계산 — 최근 3개월 변화 (단순 차이, 예측 아님)
  let trend_3m_pp: number | undefined;
  if (points.length >= 4) {
    const latest = points[points.length - 1]!;
    const threeAgo = points[points.length - 4]!;
    trend_3m_pp = Number((latest.value - threeAgo.value).toFixed(2));
  }

  const meta: JeonseMeta = {
    region,
    region_name_ko: regionMeta.name_ko,
    start_period: input.start_period,
    end_period: input.end_period,
    data_count: points.length,
    ...(trend_3m_pp !== undefined && { trend_3m_pp }),
  };

  return buildResponse({
    source: "한국부동산원 R-ONE (매매가격대비 전세가격 비율)",
    source_url: RONE_BASE_URL,
    last_updated_at: lastUpdatedAt,
    data: { meta, points, warnings },
  });
}

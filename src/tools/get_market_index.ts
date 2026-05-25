/**
 * get_market_index — KRX 시장지수 조회 (v3.0 네 번째 도구)
 *
 * @see wiki/korea-finance-mcp/tools-spec.md §3.4
 * @see wiki/korea-finance-mcp/stock-api-research.md §2.4
 *
 * 양보 불가 (회귀 st-07):
 * - index_code enum 검증 (KOSPI/KOSDAQ/KOSPI200)
 * - data_as_of_date 필수
 * - 일별 데이터만 (실시간 X)
 */

import { z } from "zod";
import { buildResponse, buildNoData } from "../lib/response.js";
import {
  fetchKrxMarketIndex,
  KRX_INDEX_CODES,
  type KrxMarketIndexItem,
  type KrxIndexCode,
} from "../lib/krx.js";
import type { ToolResponse } from "../types.js";

export const GetMarketIndexInputSchema = z.object({
  index_code: z
    .enum(["KOSPI", "KOSDAQ", "KOSPI200"])
    .describe("주요 한국 주식시장 지수"),
  start: z.string().regex(/^\d{8}$/).optional(),
  end: z.string().regex(/^\d{8}$/).optional(),
});

export type GetMarketIndexInput = z.infer<typeof GetMarketIndexInputSchema>;

export const getMarketIndexTool = {
  name: "get_market_index",
  title: "Korea Market Index Daily (KOSPI/KOSDAQ/KOSPI200)",
  description: [
    "한국 주요 시장지수 *일별* 조회 (KRX, 공공데이터포털 경유).",
    "입력: index_code (KOSPI|KOSDAQ|KOSPI200) + start/end (YYYYMMDD, 미지정 시 최근 30일).",
    "출력: 일별 지수 종가/시가/고가/저가/거래량/거래대금.",
    "⚠️ 일별 데이터만 (실시간 지수 X).",
  ].join("\n"),
  inputSchema: GetMarketIndexInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
} as const;

interface MarketIndexMeta {
  index_code: KrxIndexCode;
  index_name_ko: string;
  data_as_of_date: string;
  date_range: { start: string; end: string };
  total_days: number;
}

function defaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now.getTime() - 24 * 3600 * 1000);
  const start = new Date(end.getTime() - 30 * 24 * 3600 * 1000);
  const fmt = (d: Date): string =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

export async function executeGetMarketIndex(
  input: GetMarketIndexInput,
): Promise<ToolResponse<KrxMarketIndexItem[]>> {
  const validated = GetMarketIndexInputSchema.parse(input);

  const { start: defStart, end: defEnd } = defaultDateRange();
  const start = validated.start ?? defStart;
  const end = validated.end ?? defEnd;

  const items = await fetchKrxMarketIndex({
    index_code: validated.index_code,
    bgnDt: start,
    endDt: end,
  });

  if (items.length === 0) {
    return buildNoData({
      source: "KRX (공공데이터포털 경유)",
      source_url: "https://www.data.go.kr/data/15094808/openapi.do",
      last_updated_at: new Date().toISOString(),
      warnings: [`${validated.index_code} 기간 ${start}~${end} 0건. 영업일 +1 갱신.`],
    });
  }

  const sorted = [...items].sort((a, b) => b.basDt.localeCompare(a.basDt));
  const latest = sorted[0]!;

  const meta: MarketIndexMeta = {
    index_code: validated.index_code,
    index_name_ko: KRX_INDEX_CODES[validated.index_code],
    data_as_of_date: latest.basDt,
    date_range: { start, end },
    total_days: items.length,
  };

  return buildResponse<KrxMarketIndexItem[]>({
    source: "KRX (공공데이터포털 경유)",
    source_url: "https://www.data.go.kr/data/15094808/openapi.do",
    last_updated_at: new Date().toISOString(),
    data: items,
    meta: meta as unknown as Record<string, unknown>,
  });
}

/**
 * get_stock_price — KRX 일별 주식시세 조회 (v3.0 세 번째 도구)
 *
 * @see wiki/korea-finance-mcp/tools-spec.md §3.3
 * @see wiki/korea-finance-mcp/stock-api-research.md §2
 *
 * 양보 불가 (회귀 st-05~06):
 * - ticker(6자리) 또는 KNOWN_TICKERS 매핑
 * - 응답에 `data_as_of_date` 필수 (st-05)
 * - "실시간/현재가/지금 가격" 키워드 차단 (st-06, sanitize)
 * - 영구 배제: 실시간 호가, 주문 (excluded-tools §3.3, §7.2)
 */

import { z } from "zod";
import { buildResponse, buildNoData } from "../lib/response.js";
import {
  fetchKrxStockPrice,
  type KrxStockPriceItem,
} from "../lib/krx.js";
import { findTicker, validateTicker } from "../lib/stock-dictionaries.js";
import type { ToolResponse } from "../types.js";

export const GetStockPriceInputSchema = z.object({
  ticker: z.string().regex(/^\d{6}$/, "ticker는 6자리 숫자 (예: 005930 삼성전자)"),
  start: z.string().regex(/^\d{8}$/).optional().describe("YYYYMMDD. 기본 = end - 30일"),
  end: z.string().regex(/^\d{8}$/).optional().describe("YYYYMMDD. 기본 = 직전 영업일"),
});

export type GetStockPriceInput = z.infer<typeof GetStockPriceInputSchema>;

export const getStockPriceTool = {
  name: "get_stock_price",
  title: "Korea Stock Daily Price (KRX, NOT real-time)",
  description: [
    "한국 상장 종목 *일별* 시세 조회 (KRX, 공공데이터포털 경유).",
    "입력: ticker (6자리). start/end (YYYYMMDD, 미지정 시 최근 30일).",
    "출력: 종가/시가/고가/저가/거래량/거래대금 + 시가총액 + data_as_of_date.",
    "⚠️ *실시간 호가 없음* (영구 배제, 자본시장법 + 라이선스). 갱신 시점: 장 마감 후 영업일 +1.",
  ].join("\n"),
  inputSchema: GetStockPriceInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
} as const;

interface StockPriceMeta {
  ticker: string;
  resolved_short_name: string | null;
  data_as_of_date: string; // 가장 최신 row의 basDt
  date_range: { start: string; end: string };
  total_days: number;
  /** WO-070 패턴 healthcheck — 거래일 평균 거래량 비현실치 경고 */
  healthcheck_warning?: string;
}

function defaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now.getTime() - 24 * 3600 * 1000); // 어제
  const start = new Date(end.getTime() - 30 * 24 * 3600 * 1000); // 31일 전
  const fmt = (d: Date): string =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

export async function executeGetStockPrice(
  input: GetStockPriceInput,
): Promise<ToolResponse<KrxStockPriceItem[]>> {
  const validated = GetStockPriceInputSchema.parse(input);
  validateTicker(validated.ticker);

  const { start: defStart, end: defEnd } = defaultDateRange();
  const start = validated.start ?? defStart;
  const end = validated.end ?? defEnd;

  const knownTicker = findTicker(validated.ticker);

  const items = await fetchKrxStockPrice({
    ticker: validated.ticker,
    bgnDt: start,
    endDt: end,
  });

  if (items.length === 0) {
    return buildNoData({
      source: "KRX (공공데이터포털 경유)",
      source_url: "https://www.data.go.kr/data/15094775/openapi.do",
      last_updated_at: new Date().toISOString(),
      warnings: [
        `ticker ${validated.ticker} 기간 ${start}~${end} 시세 0건.`,
        "갱신 시점: 장 마감 후 영업일 +1 오후 1시 이후 (KRX 공식).",
      ],
    });
  }

  // 최신 row의 basDt가 data_as_of_date
  const sorted = [...items].sort((a, b) => b.basDt.localeCompare(a.basDt));
  const latest = sorted[0]!;

  const meta: StockPriceMeta = {
    ticker: validated.ticker,
    resolved_short_name: knownTicker?.short_name ?? latest.itmsNm ?? null,
    data_as_of_date: latest.basDt,
    date_range: { start, end },
    total_days: items.length,
  };

  return buildResponse<KrxStockPriceItem[]>({
    source: "KRX (공공데이터포털 경유)",
    source_url: "https://www.data.go.kr/data/15094775/openapi.do",
    last_updated_at: new Date().toISOString(),
    data: items,
    meta: meta as unknown as Record<string, unknown>,
  });
}

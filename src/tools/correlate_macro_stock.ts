/**
 * correlate_macro_stock — ⭐ v3.0 시너지 도구 1
 *
 * 거시경제 지표 (ECOS) ↔ 한국 주가 (KRX) 단순 상관계수 + 시차.
 *
 * @see wiki/korea-finance-mcp/synergy-tool-design-correlate-stock-realestate.md (자매 도구)
 * @see wiki/korea-finance-mcp/stock-api-research.md §3.1
 *
 * 양보 불가 (회귀 st-08):
 * - macro_code는 KNOWN_INDICATORS 정적 사전만 (추측 금지)
 * - ticker는 6자리 정규식 검증
 * - Pearson 단순 상관만 (회귀 분석·예측 X)
 * - MANDATORY_NOTES 4건 모두 응답에 포함 (인과·예측 부정)
 * - 주가 일간 → 월간 변환 (macro는 monthly 다수)
 */

import { z } from "zod";
import { buildResponse } from "../lib/response.js";
import { fetchEcosStatistic, parseEcosValue } from "../lib/ecos.js";
import { fetchKrxStockPrice } from "../lib/krx.js";
import { KNOWN_INDICATORS } from "./search_indicator.js";
import { findTicker, validateTicker } from "../lib/stock-dictionaries.js";
import type { ToolResponse } from "../types.js";

export const CorrelateMacroStockInputSchema = z.object({
  macro_code: z.string().min(1).describe("ECOS 통계 코드 (KNOWN_INDICATORS 사전)"),
  ticker: z.string().regex(/^\d{6}$/, "ticker는 6자리 숫자"),
  start: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM"),
  end: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM"),
  lag_months: z.number().int().min(0).max(24).optional().default(6),
});

export type CorrelateMacroStockInput = z.infer<typeof CorrelateMacroStockInputSchema>;

export const correlateMacroStockTool = {
  name: "correlate_macro_stock",
  title: "⭐ Macro ↔ Stock Correlation (Korea Synergy)",
  description: [
    "⭐ 거시경제(ECOS) ↔ 한국 개별 주가(KRX) 단순 Pearson 상관계수 + 시차.",
    "입력: macro_code (KNOWN_INDICATORS), ticker(6자리), start/end (YYYY-MM), lag_months (0~24)",
    "출력: 상관계수 + 두 시계열 (주가 월간 평균 변환) + 인과 부정 notes 4건",
    "⚠️ *단순 상관*만. 인과/예측/추천/목표주가는 응답에 *0건* 강제 (자본시장법).",
  ].join("\n"),
  inputSchema: CorrelateMacroStockInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
} as const;

export const MANDATORY_NOTES_MS = [
  "본 결과는 *단순 상관계수*이며 인과 관계를 의미하지 않습니다.",
  "시차(lag_months)는 추정값이며, 실제 거시 → 주가 반영 시점은 다를 수 있습니다.",
  "투자 의사결정은 본 데이터 *외* 다양한 요인을 고려해야 합니다.",
  "본 도구는 *예측·전망·추천·목표주가가 아닙니다*. (자본시장법 영구 잠금)",
] as const;

function interpretCorrelation(r: number): string {
  const abs = Math.abs(r);
  const direction = r >= 0 ? "양" : "음";
  if (abs < 0.2) return `사실상 무상관 (r=${r.toFixed(3)})`;
  if (abs < 0.4) return `약한 ${direction}의 상관 (r=${r.toFixed(3)})`;
  if (abs < 0.7) return `중간 ${direction}의 상관 (r=${r.toFixed(3)})`;
  return `강한 ${direction}의 상관 (r=${r.toFixed(3)})`;
}

function computePearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const ex = xs[i]! - mx;
    const ey = ys[i]! - my;
    num += ex * ey;
    dx += ex * ex;
    dy += ey * ey;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

/**
 * KRX 일별 주가 → 월간 평균 (YYYY-MM 키)
 * synergy-tool-design §3 7단계 알고리즘의 *주가 월간 변환* 단계.
 */
function stockDailyToMonthly(
  daily: Array<{ basDt: string; clpr: number }>,
): Array<{ date: string; value: number }> {
  const buckets = new Map<string, number[]>();
  for (const d of daily) {
    if (!/^\d{8}$/.test(d.basDt)) continue;
    const ym = `${d.basDt.substring(0, 4)}-${d.basDt.substring(4, 6)}`;
    if (!buckets.has(ym)) buckets.set(ym, []);
    buckets.get(ym)!.push(d.clpr);
  }
  const result: Array<{ date: string; value: number }> = [];
  for (const [ym, prices] of Array.from(buckets.entries()).sort()) {
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    result.push({ date: ym, value: avg });
  }
  return result;
}

export async function executeCorrelateMacroStock(
  input: CorrelateMacroStockInput,
): Promise<ToolResponse<unknown>> {
  const validated = CorrelateMacroStockInputSchema.parse(input);
  validateTicker(validated.ticker);

  // KNOWN_INDICATORS 검증 (추측 금지)
  const macroMeta = KNOWN_INDICATORS.find((i) => i.code === validated.macro_code);
  if (!macroMeta) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["macro_code"],
        message: `미등록 macro_code: ${validated.macro_code}. KNOWN_INDICATORS 사전만 허용.`,
      },
    ]);
  }
  const knownTicker = findTicker(validated.ticker);
  const lag = validated.lag_months ?? 6;

  // ECOS macro 호출 (월간 우선)
  const startYM = validated.start.replace("-", "");
  const endYM = validated.end.replace("-", "");
  const macroRaw = await fetchEcosStatistic({
    statCode: validated.macro_code,
    cycle: macroMeta.cycle,
    startDate: startYM,
    endDate: endYM,
    itemCode1: macroMeta.default_item_code1,
  });
  await new Promise((r) => setTimeout(r, 250));

  // KRX 주가 호출 (일간)
  const startYmd = `${startYM}01`;
  const endYmd = `${endYM}31`;
  const krxRaw = await fetchKrxStockPrice({
    ticker: validated.ticker,
    bgnDt: startYmd,
    endDt: endYmd,
  });

  // ECOS rows → {date,value}
  const macroPoints: Array<{ date: string; value: number }> = (
    macroRaw.StatisticSearch?.row ?? []
  )
    .map((r) => {
      const v = parseEcosValue(r.DATA_VALUE);
      if (v === null || !/^\d{6}$/.test(r.TIME)) return null;
      return { date: `${r.TIME.substring(0, 4)}-${r.TIME.substring(4, 6)}`, value: v };
    })
    .filter((x): x is { date: string; value: number } => x !== null);

  // KRX rows → 월간
  const stockMonthly = stockDailyToMonthly(krxRaw);

  // lag 정렬: macro_t ↔ stock_(t+lag)
  const stockMap = new Map<string, number>();
  for (const s of stockMonthly) stockMap.set(s.date, s.value);

  const aligned: Array<{ date: string; m: number; s: number }> = [];
  for (const mp of macroPoints) {
    const mDt = new Date(`${mp.date}-01T00:00:00Z`);
    mDt.setUTCMonth(mDt.getUTCMonth() + lag);
    const key = `${mDt.getUTCFullYear()}-${String(mDt.getUTCMonth() + 1).padStart(2, "0")}`;
    const s = stockMap.get(key);
    if (s !== undefined) aligned.push({ date: key, m: mp.value, s });
  }

  if (aligned.length < 3) {
    return buildResponse({
      source: "ECOS × KRX",
      source_url: "https://ecos.bok.or.kr + https://www.data.go.kr",
      last_updated_at: new Date().toISOString(),
      data: {
        correlation: null,
        interpretation: "데이터 부족 — 정렬 후 3개월 미만",
        macro_code: validated.macro_code,
        macro_name: macroMeta.name,
        ticker: validated.ticker,
        ticker_short_name: knownTicker?.short_name ?? null,
        lag_months: lag,
        aligned_count: aligned.length,
        macro_series: macroPoints,
        stock_series: stockMonthly,
        notes: MANDATORY_NOTES_MS,
      },
      warnings: ["3개월 이상 데이터 필요"],
    });
  }

  const r = computePearson(
    aligned.map((a) => a.m),
    aligned.map((a) => a.s),
  );

  return buildResponse({
    source: "ECOS × KRX",
    source_url: "https://ecos.bok.or.kr + https://www.data.go.kr",
    last_updated_at: new Date().toISOString(),
    data: {
      correlation: r,
      interpretation: interpretCorrelation(r),
      macro_code: validated.macro_code,
      macro_name: macroMeta.name,
      ticker: validated.ticker,
      ticker_short_name: knownTicker?.short_name ?? null,
      lag_months: lag,
      aligned_count: aligned.length,
      macro_series: macroPoints,
      stock_series_monthly: stockMonthly,
      aligned_pairs: aligned,
      notes: MANDATORY_NOTES_MS,
    },
    meta: {
      analysis_method: "Pearson correlation",
      stock_aggregation: "monthly_mean(close_price)",
      lag_months: lag,
    },
  });
}

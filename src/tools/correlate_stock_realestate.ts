/**
 * correlate_stock_realestate — ⭐⭐ v3.0 시너지 도구 2 (**한국 유일**)
 *
 * 한국 주가 (KRX) ↔ 한국 부동산 (R-ONE) 단순 상관계수 + 시차.
 *
 * **외국인 진입 불가** — v1.0 ECOS + v2.0 부동산 + v3.0 주식 *모두 완성된 후*에만 가능.
 *
 * @see wiki/korea-finance-mcp/synergy-tool-design-correlate-stock-realestate.md
 * @see wiki/korea-finance-mcp/strategy-4-moats.md §2 (시너지 = 진짜 해자)
 *
 * 양보 불가 (회귀 st-09 + 시너지 회귀 9건):
 * - ticker는 6자리 + KNOWN_TICKERS 우선
 * - region은 KNOWN_REGIONS_RONE 정적 사전만
 * - Pearson 단순 상관만 (회귀 분석·예측 X)
 * - MANDATORY_NOTES *5건* (correlate_macro_*보다 1건 많음 — 시너지 위험성 강화)
 * - narrative 필드 *필수* (st-09)
 */

import { z } from "zod";
import { buildResponse } from "../lib/response.js";
import { fetchKrxStockPrice } from "../lib/krx.js";
import { fetchRoneSeries, KNOWN_REGIONS_RONE, type RoneRegion } from "../lib/rone.js";
import { findTicker, validateTicker } from "../lib/stock-dictionaries.js";
import type { ToolResponse } from "../types.js";

export const CorrelateStockRealestateInputSchema = z.object({
  ticker: z.string().regex(/^\d{6}$/, "ticker는 6자리 숫자"),
  region: z.string().describe("R-ONE 지역 (KNOWN_REGIONS_RONE 사전)"),
  start: z.string().regex(/^\d{4}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}$/),
  lag_months: z.number().int().min(0).max(12).optional().default(3),
});

export type CorrelateStockRealestateInput = z.infer<typeof CorrelateStockRealestateInputSchema>;

export const correlateStockRealestateTool = {
  name: "correlate_stock_realestate",
  title: "⭐⭐ Stock ↔ Realestate Correlation (Korea Unique)",
  description: [
    "⭐⭐ **한국 유일** 시너지 — 한국 개별 주가(KRX) ↔ 한국 부동산(R-ONE) 단순 Pearson 상관계수 + 시차.",
    "입력: ticker (6자리), region (KNOWN_REGIONS_RONE), start/end (YYYY-MM), lag_months (0~12)",
    "출력: 상관계수 + 두 시계열 + narrative 해석 + 인과 부정 notes 5건",
    "⚠️ *단순 상관*만. 인과/예측/추천/목표주가/포트폴리오 추천은 응답에 *0건* 강제 (자본시장법 영구 잠금).",
    "🎯 시너지 질문 예: 건설주↔서울집값, 은행주↔금리 (단, 상관 ≠ 인과).",
  ].join("\n"),
  inputSchema: CorrelateStockRealestateInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
} as const;

// MANDATORY_NOTES — correlate_macro_*보다 *1건 더*. 시너지 위험성 강화.
export const MANDATORY_NOTES_SR = [
  "본 결과는 *단순 상관계수*이며 인과 관계를 의미하지 않습니다.",
  "주가는 *수많은 외생 변수* (실적·금리·환율·심리 등)에 영향받으며, 부동산도 마찬가지입니다.",
  "시차(lag_months)는 추정값이며 실제 반영 시점과 다를 수 있습니다.",
  "투자 의사결정은 본 데이터 *외* 종합적 분석이 필수입니다.",
  "본 도구는 *예측·전망·추천·목표주가·포트폴리오 추천이 아닙니다*. (자본시장법 §6/§101/§178 영구 잠금)",
] as const;

function interpretCorrelation(r: number): string {
  const abs = Math.abs(r);
  const direction = r >= 0 ? "양" : "음";
  if (abs < 0.2) return `사실상 무상관 (r=${r.toFixed(3)})`;
  if (abs < 0.4) return `약한 ${direction}의 상관 (r=${r.toFixed(3)})`;
  if (abs < 0.7) return `중간 ${direction}의 상관 (r=${r.toFixed(3)})`;
  return `강한 ${direction}의 상관 (r=${r.toFixed(3)})`;
}

/**
 * st-09 양보 불가: narrative 필드. *해석은 항상 단순 상관 + 인과 부정* 패턴.
 */
function buildNarrative(
  r: number,
  tickerName: string,
  regionName: string,
  lag: number,
): string {
  const interpretation = interpretCorrelation(r);
  const directionWord = r >= 0 ? "함께 움직이는 경향" : "반대로 움직이는 경향";
  return [
    `${tickerName}와(과) ${regionName} 부동산 가격은 ${interpretation}을 보입니다.`,
    `lag ${lag}개월 기준 *${directionWord}*이 관찰되지만, 이는 *통계적 상관*일 뿐 인과 관계가 아닙니다.`,
    `두 변수 모두 *금리·정책·심리·외생 충격*에 영향받는 공통 변수 노출 가능성이 더 큽니다.`,
    `본 결과는 *분석 참고용*이며 투자 의사결정 근거로 사용해서는 안 됩니다.`,
  ].join(" ");
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

export async function executeCorrelateStockRealestate(
  input: CorrelateStockRealestateInput,
): Promise<ToolResponse<unknown>> {
  const validated = CorrelateStockRealestateInputSchema.parse(input);
  validateTicker(validated.ticker);

  if (!(validated.region in KNOWN_REGIONS_RONE)) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["region"],
        message: `미등록 region: ${validated.region}. KNOWN_REGIONS_RONE 사전만 허용.`,
      },
    ]);
  }
  const region = validated.region as RoneRegion;
  const regionMeta = KNOWN_REGIONS_RONE[region]!;
  const knownTicker = findTicker(validated.ticker);
  const lag = validated.lag_months ?? 3;

  const startYM = validated.start.replace("-", "");
  const endYM = validated.end.replace("-", "");

  // KRX 일간 주가 호출
  const krxRaw = await fetchKrxStockPrice({
    ticker: validated.ticker,
    bgnDt: `${startYM}01`,
    endDt: `${endYM}31`,
  });
  await new Promise((r) => setTimeout(r, 250));

  // R-ONE 월간 부동산 호출
  let realestatePoints: Array<{ date: string; value: number; unit: string }> = [];
  try {
    realestatePoints = await fetchRoneSeries({
      stat_code: "housing_index_apt_monthly",
      region,
      start_period: startYM,
      end_period: endYM,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/INFO-200|해당하는 데이터가 없습니다/.test(msg)) throw err;
  }

  // 주가 월간 변환
  const stockMonthly = stockDailyToMonthly(krxRaw);

  // lag 정렬: stock_t ↔ realestate_(t+lag)
  const reMap = new Map<string, number>();
  for (const p of realestatePoints) reMap.set(p.date.substring(0, 7), p.value);

  const aligned: Array<{ date: string; s: number; r: number }> = [];
  for (const sp of stockMonthly) {
    const sDt = new Date(`${sp.date}-01T00:00:00Z`);
    sDt.setUTCMonth(sDt.getUTCMonth() + lag);
    const key = `${sDt.getUTCFullYear()}-${String(sDt.getUTCMonth() + 1).padStart(2, "0")}`;
    const r = reMap.get(key);
    if (r !== undefined) aligned.push({ date: key, s: sp.value, r });
  }

  const tickerName = knownTicker?.short_name ?? validated.ticker;
  const regionName = regionMeta.name_ko;

  if (aligned.length < 3) {
    return buildResponse({
      source: "KRX × R-ONE",
      source_url: "https://www.data.go.kr + https://www.r-one.co.kr",
      last_updated_at: new Date().toISOString(),
      data: {
        correlation: null,
        narrative: `데이터 부족 (정렬 후 ${aligned.length}개월). 의미 있는 상관 계산을 위해 최소 12개월 권장.`,
        interpretation: "데이터 부족",
        ticker: validated.ticker,
        ticker_short_name: tickerName,
        region,
        region_name_ko: regionName,
        lag_months: lag,
        aligned_count: aligned.length,
        stock_series_monthly: stockMonthly,
        realestate_series: realestatePoints,
        notes: MANDATORY_NOTES_SR,
      },
      warnings: ["3개월 이상 정렬 데이터 필요"],
    });
  }

  const r = computePearson(
    aligned.map((a) => a.s),
    aligned.map((a) => a.r),
  );

  return buildResponse({
    source: "KRX × R-ONE",
    source_url: "https://www.data.go.kr + https://www.r-one.co.kr",
    last_updated_at: new Date().toISOString(),
    data: {
      correlation: r,
      interpretation: interpretCorrelation(r),
      narrative: buildNarrative(r, tickerName, regionName, lag),
      ticker: validated.ticker,
      ticker_short_name: tickerName,
      region,
      region_name_ko: regionName,
      lag_months: lag,
      aligned_count: aligned.length,
      stock_series_monthly: stockMonthly,
      realestate_series: realestatePoints,
      aligned_pairs: aligned,
      notes: MANDATORY_NOTES_SR,
    },
    meta: {
      analysis_method: "Pearson correlation",
      stock_aggregation: "monthly_mean(close_price)",
      realestate_source: "R-ONE housing_index_apt_monthly",
      lag_months: lag,
      synergy_note: "한국 유일 — v1.0 ECOS + v2.0 부동산 + v3.0 주식 통합 후에만 가능",
    },
  });
}

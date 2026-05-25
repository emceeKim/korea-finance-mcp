/**
 * ⭐ correlate_macro_realestate — 거시 ↔ 부동산 상관계수 + 시차 (v2.0 시너지)
 *
 * @see wiki/korea-finance-mcp/synergy-tool-design-correlate-macro-realestate.md
 * @see wiki/korea-finance-mcp/strategy-4-moats.md §방벽 2
 *
 * 양보 불가 (회귀 re-17, re-17a~e, re-18, re-18a/b):
 * - MANDATORY_NOTES 4건 자동 부착 (재구성·축약 ❌)
 * - 인과 키워드 0건 ("원인/때문에/유발/causes")
 * - "예측/전망/추천/매수 시점" 0건
 * - KNOWN_INDICATORS + KNOWN_REGIONS_RONE 사전 매핑만 (추측 금지)
 *
 * 통념파괴 — 단순 상관계수 + 시차만. 인과 주장 절대 금지.
 */

import { z } from "zod";
import { buildResponse, buildNoData } from "../lib/response.js";
import { fetchEcosStatistic } from "../lib/ecos.js";
import { KNOWN_INDICATORS } from "./search_indicator.js";
import { ecosTimeToIso } from "./get_indicator.js";
import {
  fetchRoneSeries,
  KNOWN_REGIONS_RONE,
  type RoneRegion,
} from "../lib/rone.js";

export const CorrelateMacroRealestateInputSchema = z.object({
  macro_code: z.string().describe("ECOS 통계 코드 (KNOWN_INDICATORS 사전 매핑)"),
  region: z.string().describe("KNOWN_REGIONS_RONE alias"),
  start: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM 시작 월"),
  end: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM 종료 월"),
  lag_months: z.number().int().min(0).max(24).optional().default(6),
});

export type CorrelateMacroRealestateInput = z.infer<
  typeof CorrelateMacroRealestateInputSchema
>;

export const correlateMacroRealestateTool = {
  name: "correlate_macro_realestate",
  title: "⭐ Macro ↔ Realestate Correlation (Korea Synergy)",
  description: [
    "⭐ 거시경제 지표(ECOS) ↔ 부동산(R-ONE) 단순 상관계수 + 시차.",
    "입력: macro_code (KNOWN_INDICATORS 사전), region (KNOWN_REGIONS_RONE)",
    "      start/end (YYYY-MM), lag_months (0~24, default 6)",
    "출력: Pearson 상관계수 + 두 시계열 + 인과 부정 notes 4건",
    "⚠️ *단순 상관*만. 인과/예측/추천은 응답에 *0건* 강제.",
  ].join("\n"),
  inputSchema: CorrelateMacroRealestateInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
} as const;

// MANDATORY_NOTES — 응답에 *반드시* 모두 포함 (회귀 re-18a 검증)
export const MANDATORY_NOTES_MR = [
  "본 결과는 *단순 상관계수*이며 인과 관계를 의미하지 않습니다.",
  "시차(lag_months)는 추정값이며, 실제 거시 → 부동산 반영 시점은 다를 수 있습니다.",
  "투자 의사결정은 본 데이터 *외* 다양한 요인을 고려해야 합니다.",
  "본 도구는 *예측·전망·추천이 아닙니다*. (자본시장법 영구 잠금)",
];

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
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

// YYYY-MM → Date
function ym2date(ym: string): Date {
  return new Date(`${ym}-01T00:00:00Z`);
}

// shift macro series by lag_months (macro_t aligned with realestate_(t+lag))
function alignSeries(
  macro: Array<{ date: string; value: number }>,
  realestate: Array<{ date: string; value: number }>,
  lagMonths: number,
): Array<{ date: string; m: number; r: number }> {
  const reMap = new Map<string, number>();
  for (const p of realestate) {
    reMap.set(p.date.substring(0, 7), p.value);
  }
  const aligned: Array<{ date: string; m: number; r: number }> = [];
  for (const mp of macro) {
    const mDate = mp.date.substring(0, 7);
    const mDt = new Date(`${mDate}-01T00:00:00Z`);
    mDt.setUTCMonth(mDt.getUTCMonth() + lagMonths);
    const rKey = `${mDt.getUTCFullYear()}-${String(mDt.getUTCMonth() + 1).padStart(2, "0")}`;
    const r = reMap.get(rKey);
    if (r !== undefined) {
      aligned.push({ date: rKey, m: mp.value, r });
    }
  }
  return aligned;
}

export async function executeCorrelateMacroRealestate(
  input: CorrelateMacroRealestateInput,
) {
  // KNOWN_* 사전 매핑 검증 (re-17a, re-17b)
  const macroMeta = KNOWN_INDICATORS.find((i) => i.code === input.macro_code);
  if (!macroMeta) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["macro_code"],
        message: `미등록 macro_code: ${input.macro_code}. KNOWN_INDICATORS 사전 매핑만. 추측 금지.`,
      },
    ]);
  }
  if (!(input.region in KNOWN_REGIONS_RONE)) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["region"],
        message: `미등록 region: ${input.region}. KNOWN_REGIONS_RONE 사전 매핑만.`,
      },
    ]);
  }

  const region = input.region as RoneRegion;
  const regionMeta = KNOWN_REGIONS_RONE[region]!;
  const lag = input.lag_months ?? 6;
  const warnings: string[] = [];

  // ECOS macro 시계열 + R-ONE 부동산 시계열 직렬 호출
  const startYM = input.start.replace("-", "");
  const endYM = input.end.replace("-", "");
  const macroPeriodStart = startYM;
  const macroPeriodEnd = endYM;

  let macroRaw;
  try {
    macroRaw = await fetchEcosStatistic({
      statCode: input.macro_code,
      cycle: macroMeta.cycle,
      startDate: macroPeriodStart,
      endDate: macroPeriodEnd,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`ECOS macro 호출 실패: ${msg}`);
  }

  await new Promise((r) => setTimeout(r, 250)); // rate limit 보호 (WO-005 패턴)

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
    if (/INFO-200|해당하는 데이터가 없습니다/.test(msg)) {
      warnings.push(`R-ONE 데이터 없음: ${msg}`);
      realestatePoints = [];
    } else {
      throw err;
    }
  }

  if (realestatePoints.length === 0) {
    return buildNoData({
      source: "ECOS + R-ONE (cross-source correlation)",
      source_url: "https://ecos.bok.or.kr/api/",
      last_updated_at: new Date().toISOString(),
    });
  }

  // ECOS 응답 → {date, value}[]
  const macroSeries = (macroRaw.StatisticSearch?.row ?? []).map((row) => ({
    date: ecosTimeToIso(row.TIME, macroMeta.cycle),
    value: Number(row.DATA_VALUE),
  }));

  const realestateSeries = realestatePoints.map((p) => ({
    date: p.date,
    value: p.value,
  }));

  // lag 적용 정렬
  const aligned = alignSeries(macroSeries, realestateSeries, lag);

  if (aligned.length < 6) {
    return buildNoData({
      source: "ECOS + R-ONE (cross-source correlation)",
      source_url: "https://ecos.bok.or.kr/api/",
      last_updated_at: new Date().toISOString(),
    });
  }

  const xs = aligned.map((a) => a.m);
  const ys = aligned.map((a) => a.r);
  const r = computePearson(xs, ys);
  const interpretation = interpretCorrelation(r);

  return buildResponse({
    source: "ECOS + R-ONE (cross-source correlation, 단순 상관)",
    source_url: "https://ecos.bok.or.kr/api/",
    last_updated_at: new Date().toISOString(),
    data: {
      meta: {
        macro_code: input.macro_code,
        macro_name: macroMeta.name,
        region,
        region_name_ko: regionMeta.name_ko,
        period: { start: input.start, end: input.end },
        lag_months_applied: lag,
        data_points: aligned.length,
      },
      correlation: { pearson: Number(r.toFixed(4)), interpretation },
      macro_series: aligned.map((a) => ({ date: a.date, value: a.m })),
      realestate_series: aligned.map((a) => ({ date: a.date, value: a.r })),
      notes: MANDATORY_NOTES_MR, // ⚠️ 양보 불가
      warnings,
    },
  });
}

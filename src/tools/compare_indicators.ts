/**
 * korea-finance-mcp — Tool #4: compare_indicators
 *
 * 다지표(최대 5개) 시계열 비교. 공통 기간으로 정렬, 누락 시점은 null 유지(보간 금지).
 *
 * 양보 불가 (CONTRIBUTING.md §1.1):
 *   - `lib/*` 무수정 (Layer A 룰)
 *   - 시계열 align 시 *누락 시점은 null 유지* — 보간·추측 금지
 *   - 1개 코드라도 ECOS 에러면 throw 전파 (부분 성공으로 환각 만들지 않음)
 *   - rate-limit 보호: 직렬 호출 + 250ms delay (data-sources.md §3, ECOS 5 req/sec 추정)
 *   - 최대 5개 (Zod max) — v0.3 progressive disclosure 시점에 확장 검토
 *
 * @see wiki/korea-finance-mcp/tools-spec.md §1.4
 * @see wiki/korea-finance-mcp/data-sources.md §3 (rate-limit)
 */

import { z } from "zod";
import { fetchEcosStatistic, parseEcosValue } from "../lib/ecos.js";
import { buildResponse, buildNoData } from "../lib/response.js";
import { ecosTimeToIso } from "./get_indicator.js";
import type { EcosCycle, ToolResponse } from "../types.js";

// ============================================================
// [1] 입력 스키마
// ============================================================
const IndicatorRefSchema = z.object({
  code: z
    .string()
    .min(1)
    .describe("ECOS 통계 코드 (예: '722Y001')"),
  cycle: z
    .enum(["D", "M", "Q", "S", "Y"])
    .optional()
    .describe("(선택) 주기 — 미지정 시 'M' 사용"),
  label: z
    .string()
    .optional()
    .describe("(선택) 표시 라벨 — 미지정 시 code 사용"),
  item_code1: z
    .string()
    .optional()
    .describe("(선택) 항목 코드 1 (다항목 통계용)"),
});

export const CompareIndicatorsInputSchema = z.object({
  indicators: z
    .array(IndicatorRefSchema)
    .min(2)
    .max(5)
    .describe("비교할 지표 목록 (2~5개). N≥6은 rate-limit 위험 → Zod 거부."),
  start: z
    .string()
    .min(1)
    .describe("공통 시작 기간 (cycle 형식). 모든 지표에 동일 적용 → cycle 다르면 각 지표가 자체 변환."),
  end: z
    .string()
    .min(1)
    .describe("공통 종료 기간 (cycle 형식). start ≤ end."),
});

export type CompareIndicatorsInput = z.infer<
  typeof CompareIndicatorsInputSchema
>;

// ============================================================
// [2] MCP 도구 메타데이터
// ============================================================
export const compareIndicatorsTool = {
  name: "compare_indicators",
  title: "Compare Multiple Korea Indicators (2-5)",
  description:
    "ECOS 다지표(2~5개) 시계열 비교. 공통 기간으로 정렬, 누락 시점은 null 유지(보간 금지). " +
    "직렬 호출 + rate-limit 보호. 1개라도 ECOS 에러면 전체 실패. " +
    "단일 지표는 get_timeseries 사용. 6개 이상은 progressive disclosure(v0.3) 후 확장 예정.",
  inputSchema: CompareIndicatorsInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
} as const;

// ============================================================
// [3] 출력 타입
// ============================================================
export interface SeriesPoint {
  period: string;
  /** 값. 시계열의 해당 시점에 데이터가 없으면 null (보간 금지). */
  value: number | null;
}

export interface ComparedSeries {
  code: string;
  label: string;
  cycle: EcosCycle;
  unit: string;
  indicator_name: string;
  points: SeriesPoint[];
}

export interface CompareResult {
  series: ComparedSeries[];
  /** 공통 기간 정렬 결과 — 누락 시점은 null 유지 (보간·추측 없음). */
  alignment_note: string;
  /** 공통 기간 (정렬에 사용한 period 배열). */
  aligned_periods: string[];
}

// ============================================================
// [4] 핸들러
// ============================================================
/**
 * `compare_indicators` 도구의 실행 함수.
 *
 * 흐름:
 *   1. 입력 검증 (Zod, 2~5개)
 *   2. 각 지표별 ECOS 호출 — 직렬 + 250ms delay (rate-limit 보호)
 *   3. 각 시계열 파싱 (빈 값은 null 유지, *skip 아님*)
 *   4. 공통 기간 추출 → 모든 시계열을 동일 period 순서로 align
 *   5. buildResponse
 */
export async function executeCompareIndicators(
  input: CompareIndicatorsInput,
): Promise<ToolResponse<CompareResult>> {
  const validated = CompareIndicatorsInputSchema.parse(input);

  // 각 지표별 raw 데이터 수집 — 직렬 호출 + rate-limit 보호
  const rawSeries: ComparedSeries[] = [];
  let lastSuccessfulTime = "";

  for (let i = 0; i < validated.indicators.length; i++) {
    const ref = validated.indicators[i]!;
    const cycle = (ref.cycle ?? "M") as EcosCycle;

    // WO-024 (2026-05-25): INFO-200(데이터 없음)만 catch + 시계열 비활성.
    // 다른 에러(인증·코드 잘못·네트워크)는 throw 전파 (환각 방지 양보 불가).
    // WO-022 get_dashboard 패턴 일반화 — 외부 API 부분 실패 견고성.
    let raw;
    try {
      raw = await fetchEcosStatistic({
        statCode: ref.code,
        cycle,
        startDate: validated.start,
        endDate: validated.end,
        itemCode1: ref.item_code1,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/INFO-200|해당하는 데이터가 없습니다/.test(message)) {
        // 해당 시계열은 비활성 (points 빈 배열 → align 시 모두 null)
        rawSeries.push({
          code: ref.code,
          label: ref.label ?? ref.code,
          cycle,
          unit: "",
          indicator_name: ref.code,
          points: [],
        });
        if (i < validated.indicators.length - 1) {
          await sleep(250);
        }
        continue;
      }
      throw err;
    }

    const rows = raw.StatisticSearch?.row ?? [];
    const points: SeriesPoint[] = rows.map((r) => ({
      period: r.TIME,
      // 빈 값은 null 유지 — 보간 금지, skip 아님 (다른 시계열과 align해야 함)
      value: parseEcosValue(r.DATA_VALUE),
    }));

    // 마지막 *유효* 시점 추적 (last_updated_at 결정용)
    const lastValid = [...rows]
      .reverse()
      .find((r) => parseEcosValue(r.DATA_VALUE) !== null);
    if (lastValid && lastValid.TIME > lastSuccessfulTime) {
      lastSuccessfulTime = lastValid.TIME;
    }

    rawSeries.push({
      code: ref.code,
      label: ref.label ?? ref.code,
      cycle,
      unit: rows[0]?.UNIT_NAME ?? "",
      indicator_name: rows[0]?.STAT_NAME ?? ref.code,
      points,
    });

    // rate-limit 보호 (마지막 호출 후엔 불필요)
    if (i < validated.indicators.length - 1) {
      await sleep(250);
    }
  }

  // 모든 시계열이 빈 값이면 buildNoData
  const totalPoints = rawSeries.reduce(
    (acc, s) => acc + s.points.filter((p) => p.value !== null).length,
    0,
  );
  if (totalPoints === 0) {
    return buildNoData({
      source: "한국은행 ECOS API",
      source_url: "https://ecos.bok.or.kr/api/",
      last_updated_at: new Date().toISOString(),
    });
  }

  // 공통 기간 추출 (모든 시계열의 period 합집합)
  const allPeriods = new Set<string>();
  for (const s of rawSeries) {
    for (const p of s.points) {
      allPeriods.add(p.period);
    }
  }
  const aligned_periods = Array.from(allPeriods).sort();

  // 각 시계열을 aligned_periods에 맞춰 정렬 (없는 시점은 null)
  const alignedSeries: ComparedSeries[] = rawSeries.map((s) => {
    const periodToValue = new Map(s.points.map((p) => [p.period, p.value]));
    return {
      ...s,
      points: aligned_periods.map((period) => ({
        period,
        value: periodToValue.get(period) ?? null,
      })),
    };
  });

  // 어느 시계열에 누락이 있는지 카운트 (warnings용)
  const missingCount = alignedSeries.reduce(
    (acc, s) => acc + s.points.filter((p) => p.value === null).length,
    0,
  );

  const cycle = (validated.indicators[0]?.cycle ?? "M") as EcosCycle;

  return buildResponse<CompareResult>({
    source: "한국은행 ECOS API",
    source_url: "https://ecos.bok.or.kr/api/",
    last_updated_at: lastSuccessfulTime
      ? ecosTimeToIso(lastSuccessfulTime, cycle)
      : new Date().toISOString(),
    data: {
      series: alignedSeries,
      alignment_note:
        "각 시계열을 공통 기간으로 정렬했습니다. " +
        "누락 시점은 null로 유지되며 보간·추측하지 않습니다.",
      aligned_periods,
    },
    meta: {
      indicators_count: validated.indicators.length,
      aligned_periods_count: aligned_periods.length,
      missing_points_total: missingCount,
      query_window: {
        startDate: validated.start,
        endDate: validated.end,
      },
    },
    warnings:
      missingCount > 0
        ? [
            `정렬 결과 총 ${missingCount}개 시점의 값이 누락(null)되어 있습니다. ` +
              "보간·추측하지 않았습니다. 원천 데이터 확인 권장.",
          ]
        : undefined,
  });
}

// ============================================================
// [5] 헬퍼
// ============================================================
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

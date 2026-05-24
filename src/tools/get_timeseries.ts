/**
 * korea-finance-mcp — Tool #3: get_timeseries
 *
 * ECOS 통계의 시계열 조회. 단일 시점은 `get_indicator`, 코드 검색은 `search_indicator` 사용.
 *
 * 양보 불가 (CONTRIBUTING.md §1.1):
 *   - `lib/*` 무수정 (Layer A 룰) — `ecosTimeToIso`는 `get_indicator.ts`에서 export 공유
 *   - 빈 DATA_VALUE는 *skip* (보간·추측 금지) — meta.skipped_null_values에 누락 건수 명시
 *   - 전부 빈 값이면 `buildNoData()`
 *   - `last_updated_at`은 시계열 *마지막 유효 시점*의 ECOS TIME 사용 (추측 금지)
 *
 * @see wiki/korea-finance-mcp/tools-spec.md §1.3
 * @see CONTRIBUTING.md §도구 1개 추가 5단계
 */

import { z } from "zod";
import { fetchEcosStatistic, parseEcosValue } from "../lib/ecos.js";
import { buildResponse, buildNoData } from "../lib/response.js";
import { ecosTimeToIso } from "./get_indicator.js";
import type { EcosCycle, EcosIndicatorPoint, ToolResponse } from "../types.js";

// ============================================================
// [1] 입력 스키마
// ============================================================
export const GetTimeseriesInputSchema = z.object({
  indicator_code: z
    .string()
    .min(1)
    .describe(
      "ECOS 통계 코드 (예: '722Y001' 기준금리). 코드 모를 때는 search_indicator 먼저.",
    ),
  cycle: z
    .enum(["D", "M", "Q", "S", "Y"])
    .describe(
      "주기 — D: 일별(YYYYMMDD), M: 월별(YYYYMM), Q: 분기별(YYYYQq), S: 반기별(YYYYSh), Y: 연도별(YYYY).",
    ),
  start: z
    .string()
    .min(1)
    .describe(
      "시작 기간 — cycle 형식에 맞춰야 함 (예: M='202401', D='20240101', Q='2024Q1', Y='2024').",
    ),
  end: z
    .string()
    .min(1)
    .describe("종료 기간 — start와 동일 형식. start ≤ end."),
  item_code1: z
    .string()
    .optional()
    .describe("(선택) 항목 코드 1 — 다항목 통계에서만 필요."),
});

export type GetTimeseriesInput = z.infer<typeof GetTimeseriesInputSchema>;

// ============================================================
// [2] MCP 도구 메타데이터
// ============================================================
export const getTimeseriesTool = {
  name: "get_timeseries",
  description:
    "ECOS 통계의 시계열 조회 — 지정 기간의 전체 시점 데이터. " +
    "단일 시점은 get_indicator, 코드 검색은 search_indicator 사용. " +
    "최대 1000행 (v0.x). 빈 값은 skip (보간·추측 금지, meta.skipped_null_values 표기).",
  inputSchema: GetTimeseriesInputSchema,
} as const;

// ============================================================
// [3] 핸들러
// ============================================================
/**
 * `get_timeseries` 도구의 실행 함수.
 *
 * 흐름:
 *   1. 입력 검증 (Zod) + period 형식 cycle 정합성 검증
 *   2. ECOS API 호출
 *   3. 응답 파싱 — 각 row를 EcosIndicatorPoint로 변환, 빈 DATA_VALUE는 skip
 *   4. 결과 0건이면 buildNoData, 아니면 buildResponse
 */
export async function executeGetTimeseries(
  input: GetTimeseriesInput,
): Promise<ToolResponse<EcosIndicatorPoint[]>> {
  const validated = GetTimeseriesInputSchema.parse(input);

  // period 형식 ↔ cycle 정합성 (입력 검증 2차 방어선, 환각 방지 5규칙 #3)
  validatePeriodFormat(validated.cycle, validated.start);
  validatePeriodFormat(validated.cycle, validated.end);

  const raw = await fetchEcosStatistic({
    statCode: validated.indicator_code,
    cycle: validated.cycle,
    startDate: validated.start,
    endDate: validated.end,
    itemCode1: validated.item_code1,
  });

  const rows = raw.StatisticSearch?.row ?? [];
  if (rows.length === 0) {
    return buildNoData({
      source: "한국은행 ECOS API",
      source_url: "https://ecos.bok.or.kr/api/",
      last_updated_at: new Date().toISOString(),
    });
  }

  // 시계열 파싱 — 빈 값은 skip (보간·추측 금지)
  const points: EcosIndicatorPoint[] = [];
  let lastValidTime = "";
  let skipped = 0;
  for (const row of rows) {
    const value = parseEcosValue(row.DATA_VALUE);
    if (value === null) {
      skipped += 1;
      continue;
    }
    points.push({
      indicator_code: row.STAT_CODE,
      indicator_name: row.STAT_NAME,
      period: row.TIME,
      value,
      unit: row.UNIT_NAME ?? "",
      cycle: validated.cycle as EcosCycle,
    });
    lastValidTime = row.TIME;
  }

  if (points.length === 0) {
    return buildNoData({
      source: "한국은행 ECOS API",
      source_url: "https://ecos.bok.or.kr/api/",
      last_updated_at: new Date().toISOString(),
    });
  }

  return buildResponse<EcosIndicatorPoint[]>({
    source: "한국은행 ECOS API",
    source_url: "https://ecos.bok.or.kr/api/",
    last_updated_at: ecosTimeToIso(lastValidTime, validated.cycle as EcosCycle),
    data: points,
    meta: {
      total_rows_in_window: raw.StatisticSearch?.list_total_count ?? rows.length,
      returned: points.length,
      skipped_null_values: skipped,
      query_window: {
        startDate: validated.start,
        endDate: validated.end,
        cycle: validated.cycle,
      },
    },
    warnings:
      skipped > 0
        ? [
            `시계열 중 ${skipped}건의 빈 값(DATA_VALUE='-' 또는 빈 문자열)을 skip함. ` +
              "보간·추측하지 않음. 원천 데이터 확인 권장.",
          ]
        : undefined,
  });
}

// ============================================================
// [4] 헬퍼
// ============================================================
/**
 * cycle별 period 형식 검증.
 * 환각 방지 5규칙 #3 (추측 금지) — 형식 어긋난 입력을 ECOS API에 그대로 보내 *잘못된 응답*을 받지 않도록.
 *
 * - D: YYYYMMDD (8자리 숫자)
 * - M: YYYYMM (6자리 숫자)
 * - Q: YYYY + 'Q' + 1~4 (예: 2024Q1)
 * - S: YYYY + 'S' + 1~2 (예: 2024S1)
 * - Y: YYYY (4자리 숫자)
 */
function validatePeriodFormat(cycle: string, period: string): void {
  const patterns: Record<string, RegExp> = {
    D: /^\d{8}$/,
    M: /^\d{6}$/,
    Q: /^\d{4}Q[1-4]$/,
    S: /^\d{4}S[1-2]$/,
    Y: /^\d{4}$/,
  };
  const expected = patterns[cycle];
  if (!expected) {
    throw new Error(`[get_timeseries] 알 수 없는 cycle: ${cycle}`);
  }
  if (!expected.test(period)) {
    throw new Error(
      `[get_timeseries] period '${period}'가 cycle '${cycle}' 형식과 맞지 않음. ` +
        `기대 형식: ${expected.source}. ` +
        "예: M='YYYYMM' (202401), D='YYYYMMDD' (20240101), Q='YYYYQq' (2024Q1).",
    );
  }
}

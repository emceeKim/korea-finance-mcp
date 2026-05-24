/**
 * korea-finance-mcp — Tool #1: get_indicator
 *
 * 단일 지표의 현재값을 조회한다 (예: 기준금리, 환율).
 * 본 도구는 다른 모든 도구의 **표준 패턴**이다.
 * 새 도구 추가 시 이 파일을 복사·수정해서 사용한다.
 *
 * @see CONTRIBUTING.md §도구 1개 추가 5단계
 */

import { z } from "zod";
import { fetchEcosStatistic, parseEcosValue } from "../lib/ecos.js";
import { buildResponse, buildNoData } from "../lib/response.js";
import type { EcosCycle, EcosIndicatorPoint, ToolResponse } from "../types.js";

// ============================================================
// [1] 입력 스키마 — Zod로 모든 입력 검증 (환각 방지 2차 방어선)
// ============================================================
export const GetIndicatorInputSchema = z.object({
  indicator_code: z
    .string()
    .min(1)
    .describe(
      "ECOS 통계 코드 (예: '722Y001' 기준금리, '731Y001' 원/달러 환율). " +
        "코드 모를 때는 search_indicator 먼저 사용.",
    ),
  cycle: z
    .enum(["D", "M", "Q", "S", "Y"])
    .default("M")
    .describe("주기 — D: 일별, M: 월별, Q: 분기별, S: 반기별, Y: 연도별. 기본 'M'."),
  item_code1: z
    .string()
    .optional()
    .describe(
      "(선택) 항목 코드 1. 통계 코드가 다항목일 때만 필요 (예: 환율 통계의 통화 코드).",
    ),
});

export type GetIndicatorInput = z.infer<typeof GetIndicatorInputSchema>;

// ============================================================
// [2] MCP 도구 메타데이터 — index.ts에서 등록 시 사용
// ============================================================
export const getIndicatorTool = {
  name: "get_indicator",
  description:
    "한국은행 ECOS의 단일 통계 지표 현재값을 조회한다. " +
    "기준금리·환율·CPI·M2·GDP 등 6만+ 시계열 접근 가능. " +
    "코드를 모를 때는 'search_indicator' 도구를 먼저 사용할 것.",
  inputSchema: GetIndicatorInputSchema,
} as const;

// ============================================================
// [3] 핸들러 — 실제 ECOS 호출 + 표준 응답 빌드
// ============================================================
/**
 * `get_indicator` 도구의 실행 함수.
 *
 * 흐름:
 *   1. 입력 검증 (Zod)
 *   2. 조회 기간 결정 — 최신 1개월 (월별) / 최신 1년 (연별) 등
 *   3. ECOS API 호출
 *   4. 응답 파싱 → `EcosIndicatorPoint` 변환
 *   5. 표준 응답 빌드 (면책 자동 부착)
 */
export async function executeGetIndicator(
  input: GetIndicatorInput,
): Promise<ToolResponse<EcosIndicatorPoint>> {
  const validated = GetIndicatorInputSchema.parse(input);

  // 조회 기간 — 최근 12개 단위로 조회 후 가장 최신값 선택
  const { startDate, endDate } = computeRecentPeriod(validated.cycle);

  const raw = await fetchEcosStatistic({
    statCode: validated.indicator_code,
    cycle: validated.cycle,
    startDate,
    endDate,
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

  // 최신 행 = 배열 마지막 (ECOS는 오름차순 반환)
  const latest = rows[rows.length - 1]!;
  const value = parseEcosValue(latest.DATA_VALUE);

  if (value === null) {
    return buildNoData({
      source: "한국은행 ECOS API",
      source_url: "https://ecos.bok.or.kr/api/",
      last_updated_at: new Date().toISOString(),
    });
  }

  const point: EcosIndicatorPoint = {
    indicator_code: latest.STAT_CODE,
    indicator_name: latest.STAT_NAME,
    period: latest.TIME,
    value,
    unit: latest.UNIT_NAME ?? "",
    cycle: validated.cycle as EcosCycle,
  };

  return buildResponse<EcosIndicatorPoint>({
    source: "한국은행 ECOS API",
    source_url: "https://ecos.bok.or.kr/api/",
    last_updated_at: ecosTimeToIso(latest.TIME, validated.cycle),
    data: point,
    meta: {
      total_rows_in_window: raw.StatisticSearch?.list_total_count ?? rows.length,
      query_window: { startDate, endDate },
    },
  });
}

// ============================================================
// [4] 헬퍼 (도구 내부용)
// ============================================================
function computeRecentPeriod(cycle: EcosCycle): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  switch (cycle) {
    case "D":
      // 최근 30일
      return {
        startDate: ymd(addDays(now, -30)),
        endDate: `${yyyy}${mm}${dd}`,
      };
    case "M":
      // 최근 12개월
      return {
        startDate: `${yyyy - 1}${mm}`,
        endDate: `${yyyy}${mm}`,
      };
    case "Q":
      // 최근 8분기
      return { startDate: `${yyyy - 2}Q1`, endDate: `${yyyy}Q4` };
    case "S":
      return { startDate: `${yyyy - 2}S1`, endDate: `${yyyy}S2` };
    case "Y":
      return { startDate: `${yyyy - 10}`, endDate: `${yyyy}` };
  }
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function addDays(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + delta);
  return x;
}

/**
 * ECOS의 TIME 문자열 ("202405" / "20260525" / "2026Q1")을 ISO 8601로 변환.
 * 추측 금지 — 변환 불가하면 현재 시각 사용 (추후 v0.2에서 정밀화).
 */
function ecosTimeToIso(time: string, cycle: EcosCycle): string {
  if (cycle === "D" && /^\d{8}$/.test(time)) {
    return `${time.slice(0, 4)}-${time.slice(4, 6)}-${time.slice(6, 8)}T00:00:00Z`;
  }
  if (cycle === "M" && /^\d{6}$/.test(time)) {
    return `${time.slice(0, 4)}-${time.slice(4, 6)}-01T00:00:00Z`;
  }
  if (cycle === "Y" && /^\d{4}$/.test(time)) {
    return `${time}-01-01T00:00:00Z`;
  }
  // 분기·반기는 v0.2에서 정밀 변환 추가
  return new Date().toISOString();
}

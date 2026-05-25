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
import { KNOWN_INDICATORS } from "./search_indicator.js";
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

  // ============================================================
  // WO-070 (2026-05-25): KNOWN_INDICATORS 매칭 시 default_item_code1 자동 부착.
  //
  // 통념파괴: "LLM이 알아서 item_code1을 추론하면 된다" → 틀림. 그러면 우리 시스템의
  //   "추측 금지 + KNOWN_INDICATORS 정적 사전" 헌법이 무력화된다. **서버 측에서**
  //   다항목 통계를 식별·자동 부착하고, 응답값이 현실범위 밖이면 경고로 차단해야 진짜 차별화.
  // ============================================================
  const known = KNOWN_INDICATORS.find((k) => k.code === validated.indicator_code);
  const effectiveItemCode1 =
    validated.item_code1 ?? (known?.multi_item ? known.default_item_code1 : undefined);
  const autoAttached = !validated.item_code1 && effectiveItemCode1 !== undefined;

  // 조회 기간 — 최근 12개 단위로 조회 후 가장 최신값 선택
  const { startDate, endDate } = computeRecentPeriod(validated.cycle);

  const raw = await fetchEcosStatistic({
    statCode: validated.indicator_code,
    cycle: validated.cycle,
    startDate,
    endDate,
    itemCode1: effectiveItemCode1,
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

  // WO-070 healthcheck: KNOWN_INDICATORS expected_range 검증
  const outOfRange =
    known?.expected_range !== undefined &&
    (value < known.expected_range[0] || value > known.expected_range[1]);

  const extraMeta: Record<string, unknown> = {};
  if (autoAttached) {
    extraMeta["auto_attached_item_code1"] = effectiveItemCode1;
    extraMeta["auto_attached_reason"] =
      "다항목 통계 — KNOWN_INDICATORS default_item_code1 자동 부착";
  }
  if (outOfRange && known?.expected_range) {
    extraMeta["healthcheck_warning"] =
      `값 ${value} ${known.unit}은(는) ${known.name} 예상범위 ` +
      `${known.expected_range[0]}~${known.expected_range[1]} 밖입니다. ` +
      `다항목 통계 + item_code1 또는 단위 확인 필요.`;
  }

  return buildResponse<EcosIndicatorPoint>({
    source: "한국은행 ECOS API",
    source_url: "https://ecos.bok.or.kr/api/",
    last_updated_at: ecosTimeToIso(latest.TIME, validated.cycle),
    data: point,
    meta: {
      total_rows_in_window: raw.StatisticSearch?.list_total_count ?? rows.length,
      query_window: { startDate, endDate },
      ...extraMeta,
    },
  });
}

// ============================================================
// [4] 헬퍼 (도구 내부용)
// ============================================================
/**
 * @public Layer A 도구 간 공유 — `get_dashboard` 등이 동일 윈도 로직 사용.
 *   v0.3에서 `src/tools/_helpers.ts` 분리 검토.
 */
export function computeRecentPeriod(cycle: EcosCycle): {
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
      // 최근 12개월 (현재 월까지만)
      return {
        startDate: `${yyyy - 1}${mm}`,
        endDate: `${yyyy}${mm}`,
      };
    case "Q": {
      // WO-017 핫픽스: 미래 분기 미포함. 현재 월 기준 *이전 분기*까지만 (발표 지연 보정).
      // 예: 2026-05 (Q2 진행 중) → end = 2026Q1 (가장 최근 발표 분기)
      const monthIdx = now.getUTCMonth(); // 0~11
      let qNum = Math.floor(monthIdx / 3); // 0=Q1진행중→이전=작년Q4, 1=Q2진행중→Q1, 2=Q3진행중→Q2, 3=Q4진행중→Q3
      let qYear = yyyy;
      if (qNum === 0) {
        qYear -= 1;
        qNum = 4;
      }
      return { startDate: `${qYear - 2}Q1`, endDate: `${qYear}Q${qNum}` };
    }
    case "S": {
      // 반기도 동일 (현재 반기 미포함)
      const monthIdx = now.getUTCMonth();
      let sNum = monthIdx < 6 ? 0 : 1; // 0=H1진행중→작년H2, 1=H2진행중→H1
      let sYear = yyyy;
      if (sNum === 0) {
        sYear -= 1;
        sNum = 2;
      }
      return { startDate: `${sYear - 2}S1`, endDate: `${sYear}S${sNum}` };
    }
    case "Y": {
      // 연도도 동일 (작년까지 — 현재 연도 미완료)
      return { startDate: `${yyyy - 10}`, endDate: `${yyyy - 1}` };
    }
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
 *
 * @public Layer A 도구 간 공유용. lib/* 수정을 피하기 위한 도구 영역 helper export.
 *   v0.3에서 lib/ecos-time.ts로 이관 검토.
 */
export function ecosTimeToIso(time: string, cycle: EcosCycle): string {
  if (cycle === "D" && /^\d{8}$/.test(time)) {
    return `${time.slice(0, 4)}-${time.slice(4, 6)}-${time.slice(6, 8)}T00:00:00Z`;
  }
  if (cycle === "M" && /^\d{6}$/.test(time)) {
    return `${time.slice(0, 4)}-${time.slice(4, 6)}-01T00:00:00Z`;
  }
  if (cycle === "Y" && /^\d{4}$/.test(time)) {
    return `${time}-01-01T00:00:00Z`;
  }
  // WO-018 (2026-05-25): Q/S 변환 추가 (v0.2 백로그 정밀화)
  if (cycle === "Q" && /^\d{4}Q[1-4]$/.test(time)) {
    const year = time.slice(0, 4);
    const q = parseInt(time.slice(5), 10);
    const month = String((q - 1) * 3 + 1).padStart(2, "0"); // Q1→01, Q2→04, Q3→07, Q4→10
    return `${year}-${month}-01T00:00:00Z`;
  }
  if (cycle === "S" && /^\d{4}S[1-2]$/.test(time)) {
    const year = time.slice(0, 4);
    const s = parseInt(time.slice(5), 10);
    const month = s === 1 ? "01" : "07";
    return `${year}-${month}-01T00:00:00Z`;
  }
  // 매칭 실패 시 fallback (추측 금지 원칙 — 다만 회귀 안전망)
  return new Date().toISOString();
}

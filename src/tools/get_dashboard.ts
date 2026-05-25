/**
 * korea-finance-mcp — Tool #5: get_dashboard
 *
 * 주요 지표 종합 스냅샷 — search_indicator의 KNOWN_INDICATORS(검증된 정적 사전)의 모든 통계에 대해 최신값을 일괄 조회.
 *
 * 양보 불가 (CONTRIBUTING.md §1.1):
 *   - `lib/*` 무수정 (Layer A 룰) — KNOWN_INDICATORS·computeRecentPeriod·ecosTimeToIso는 도구 영역 import
 *   - 정적 사전에 등록된(=사람이 검증한) 코드만 노출 — 추측·생성 금지
 *   - 빈 값 지표는 skip + `meta.skipped_codes` 명시 + warnings 자동 (보간 금지)
 *   - 전부 빈 값이면 `buildNoData()`
 *   - 1개라도 ECOS 에러면 throw 전파 (부분 성공으로 환각 만들지 않음, compare_indicators 동일 패턴)
 *   - rate-limit 보호: 직렬 호출 + 250ms delay
 *   - `last_updated_at` = 각 지표 period의 ISO 변환 중 가장 최신 (API 응답값 기반, 추측 금지)
 *   - `generated_at` = 도구 호출 시각 (스냅샷 생성 시점, *데이터 기준일 아님*)
 *
 * @see wiki/korea-finance-mcp/tools-spec.md §1.5
 */

import { z } from "zod";
import { fetchEcosStatistic, parseEcosValue } from "../lib/ecos.js";
import { buildResponse, buildNoData } from "../lib/response.js";
import { computeRecentPeriod, ecosTimeToIso } from "./get_indicator.js";
import { KNOWN_INDICATORS } from "./search_indicator.js";
import type { EcosCycle, EcosIndicatorPoint, ToolResponse } from "../types.js";

// ============================================================
// [1] 입력 스키마 — v0.x는 무인자 (categories 필터는 v0.4)
// ============================================================
export const GetDashboardInputSchema = z
  .object({})
  .describe(
    "주요 지표 스냅샷 (인자 없음). v0.4에서 categories 필터 추가 예정.",
  );

export type GetDashboardInput = z.infer<typeof GetDashboardInputSchema>;

// ============================================================
// [2] MCP 도구 메타데이터
// ============================================================
export const getDashboardTool = {
  name: "get_dashboard",
  description:
    "검증된 핵심 지표(KNOWN_INDICATORS, 정적 사전)의 최신값을 일괄 스냅샷. " +
    "직렬 호출 + rate-limit 보호. 빈 값 지표는 skip + warnings. " +
    "전부 빈 값이면 No Data. 1개라도 ECOS 에러면 전체 실패 (환각 방지). " +
    "v0.x는 인자 없음, v0.4에서 categories 필터 추가 예정.",
  inputSchema: GetDashboardInputSchema,
} as const;

// ============================================================
// [3] 출력 타입
// ============================================================
export interface DashboardResult {
  indicators: EcosIndicatorPoint[];
  /** 스냅샷 생성 시각 (도구 호출 시점, ISO 8601). 데이터 기준일은 last_updated_at 참조. */
  generated_at: string;
}

// ============================================================
// [4] 핸들러
// ============================================================
export async function executeGetDashboard(
  input: GetDashboardInput,
): Promise<ToolResponse<DashboardResult>> {
  GetDashboardInputSchema.parse(input);

  if (KNOWN_INDICATORS.length === 0) {
    return buildNoData({
      source: "한국은행 ECOS API (정적 사전, v0.x)",
      source_url: "https://ecos.bok.or.kr/api/",
      last_updated_at: new Date().toISOString(),
    });
  }

  const points: EcosIndicatorPoint[] = [];
  const skipped_codes: string[] = [];

  for (let i = 0; i < KNOWN_INDICATORS.length; i++) {
    const ind = KNOWN_INDICATORS[i]!;
    const cycle = ind.cycle as EcosCycle;
    const { startDate, endDate } = computeRecentPeriod(cycle);

    // WO-022 (2026-05-25): INFO-200(해당 데이터 없음)만 catch + skip.
    // 다른 에러(인증·코드 잘못·네트워크 등)는 throw 전파 (환각 방지 양보 불가).
    // 이 분리가 *환각 방지 + 견고성* 동시 달성. v0.3 백로그 옵션 C 즉시 실행.
    let raw;
    try {
      raw = await fetchEcosStatistic({
        statCode: ind.code,
        cycle,
        startDate,
        endDate,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/INFO-200|해당하는 데이터가 없습니다/.test(message)) {
        // 해당 코드만 skip, 다른 코드 계속
        skipped_codes.push(ind.code);
        if (i < KNOWN_INDICATORS.length - 1) {
          await sleep(250);
        }
        continue;
      }
      // 다른 에러는 전파 (환각 방지)
      throw err;
    }

    const rows = raw.StatisticSearch?.row ?? [];
    // 최신 *유효* row 찾기 (역순 first valid). 빈 값은 보간 금지, skip.
    const lastValid = [...rows]
      .reverse()
      .find((r) => parseEcosValue(r.DATA_VALUE) !== null);

    if (!lastValid) {
      skipped_codes.push(ind.code);
    } else {
      const value = parseEcosValue(lastValid.DATA_VALUE)!;
      points.push({
        indicator_code: lastValid.STAT_CODE,
        indicator_name: lastValid.STAT_NAME,
        period: lastValid.TIME,
        value,
        unit: lastValid.UNIT_NAME ?? ind.unit,
        cycle,
      });
    }

    // rate-limit (마지막 호출 후엔 불필요)
    if (i < KNOWN_INDICATORS.length - 1) {
      await sleep(250);
    }
  }

  if (points.length === 0) {
    return buildNoData({
      source: "한국은행 ECOS API (정적 사전, v0.x)",
      source_url: "https://ecos.bok.or.kr/api/",
      last_updated_at: new Date().toISOString(),
    });
  }

  // last_updated_at = 각 지표 period ISO 중 가장 최신 (API 응답값 기반)
  const allIsos = points.map((p) => ecosTimeToIso(p.period, p.cycle));
  const lastIso = [...allIsos].sort().reverse()[0]!;

  return buildResponse<DashboardResult>({
    source: "한국은행 ECOS API (정적 사전, v0.x)",
    source_url: "https://ecos.bok.or.kr/api/",
    last_updated_at: lastIso,
    data: {
      indicators: points,
      generated_at: new Date().toISOString(),
    },
    meta: {
      total_indicators_in_dict: KNOWN_INDICATORS.length,
      returned: points.length,
      skipped: skipped_codes.length,
      skipped_codes,
    },
    warnings:
      skipped_codes.length > 0
        ? [
            `${skipped_codes.length}개 지표(${skipped_codes.join(", ")})는 최신 데이터 없음 — skip. ` +
              "보간·추측하지 않음. 원천 데이터 확인 권장.",
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

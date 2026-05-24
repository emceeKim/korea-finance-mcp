/**
 * 회귀 테스트 — compare_indicators
 *
 * 시나리오 5건. 환각 방지 + 다지표 align 특화 룰 검증.
 *
 *   #1 정상 2개 시계열 비교 → series 2건 + 공통 기간 align + 표준 4필드
 *   #2 1개 시계열은 row 0건 (데이터 없음) → 해당 series의 points는 모두 null + warnings + alignment 유지
 *   #3 indicators.length=6 → ZodError (max 5)
 *   #4 1개 ECOS 에러 → throw 전파 (부분 성공으로 환각 만들지 않음)
 *   #5 align — 두 시계열의 공통 기간만 추출, 한쪽만 있는 시점은 null로 표시 (보간 없음)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertStandardResponse, makeEcosResponse } from "../setup.js";

vi.mock("../../src/lib/ecos.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/ecos.js")>();
  return {
    ...actual,
    fetchEcosStatistic: vi.fn(),
  };
});

import * as ecos from "../../src/lib/ecos.js";
import { executeCompareIndicators } from "../../src/tools/compare_indicators.js";

const mockFetch = vi.mocked(ecos.fetchEcosStatistic);

describe("compare_indicators — 회귀 5건", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    ecos.clearEcosCache();
    vi.useFakeTimers();
  });

  // ──────────────────────────────────────────────
  // #1 정상 2개 시계열
  // ──────────────────────────────────────────────
  it("#1 정상 2개 시계열 비교 → series 2건 + align + 표준 4필드", async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeEcosResponse([
          { STAT_CODE: "722Y001", STAT_NAME: "기준금리", TIME: "202402", DATA_VALUE: "3.5", UNIT_NAME: "%" },
          { STAT_CODE: "722Y001", STAT_NAME: "기준금리", TIME: "202403", DATA_VALUE: "3.5", UNIT_NAME: "%" },
        ]),
      )
      .mockResolvedValueOnce(
        makeEcosResponse([
          { STAT_CODE: "731Y001", STAT_NAME: "환율", TIME: "202402", DATA_VALUE: "1330", UNIT_NAME: "원" },
          { STAT_CODE: "731Y001", STAT_NAME: "환율", TIME: "202403", DATA_VALUE: "1340", UNIT_NAME: "원" },
        ]),
      );

    const promise = executeCompareIndicators({
      indicators: [
        { code: "722Y001", cycle: "M", label: "BOK 기준금리" },
        { code: "731Y001", cycle: "M", label: "원/달러" },
      ],
      start: "202402",
      end: "202403",
    });
    // rate-limit delay (250ms) 통과
    await vi.advanceTimersByTimeAsync(300);
    const res = await promise;

    assertStandardResponse(res);
    expect(res.data!.series.length).toBe(2);
    expect(res.data!.series[0].code).toBe("722Y001");
    expect(res.data!.series[0].label).toBe("BOK 기준금리");
    expect(res.data!.series[1].code).toBe("731Y001");
    expect(res.data!.aligned_periods).toEqual(["202402", "202403"]);
    expect(res.data!.series[0].points[0]).toEqual({ period: "202402", value: 3.5 });
    expect(res.data!.series[1].points[1]).toEqual({ period: "202403", value: 1340 });
    expect(res.meta?.indicators_count).toBe(2);
    expect(res.meta?.missing_points_total).toBe(0);
  });

  // ──────────────────────────────────────────────
  // #2 1개 시계열은 데이터 없음 → null 유지 + warnings
  // ──────────────────────────────────────────────
  it("#2 1개 시계열은 빈 응답 → 해당 series points 모두 null + warnings + alignment 유지", async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeEcosResponse([
          { STAT_CODE: "722Y001", STAT_NAME: "기준금리", TIME: "202402", DATA_VALUE: "3.5", UNIT_NAME: "%" },
          { STAT_CODE: "722Y001", STAT_NAME: "기준금리", TIME: "202403", DATA_VALUE: "3.5", UNIT_NAME: "%" },
        ]),
      )
      .mockResolvedValueOnce(makeEcosResponse([])); // 2번째 빈 응답

    const promise = executeCompareIndicators({
      indicators: [
        { code: "722Y001", cycle: "M" },
        { code: "EMPTY", cycle: "M" },
      ],
      start: "202402",
      end: "202403",
    });
    await vi.advanceTimersByTimeAsync(300);
    const res = await promise;

    assertStandardResponse(res);
    expect(res.data!.series.length).toBe(2);
    // 두번째 시계열의 모든 points는 null
    expect(res.data!.series[1].points.every((p) => p.value === null)).toBe(true);
    expect(res.warnings).toBeDefined();
    expect(res.warnings![0]).toContain("누락");
    expect(res.warnings![0]).toContain("보간·추측하지 않");
  });

  // ──────────────────────────────────────────────
  // #3 indicators.length=6 → ZodError
  // ──────────────────────────────────────────────
  it("#3 indicators 6개는 ZodError로 거부된다 (max 5, rate-limit 보호)", async () => {
    vi.useRealTimers(); // sync 거부이므로 fake timer 불필요
    await expect(
      executeCompareIndicators({
        indicators: [
          { code: "A" }, { code: "B" }, { code: "C" },
          { code: "D" }, { code: "E" }, { code: "F" },
        ],
        start: "202401",
        end: "202412",
      }),
    ).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // #4 1개 ECOS 에러 → throw 전파
  // ──────────────────────────────────────────────
  it("#4 N개 중 1개라도 ECOS 에러면 throw 전파 (부분 성공으로 환각 만들지 않음)", async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeEcosResponse([
          { STAT_CODE: "A", STAT_NAME: "A", TIME: "202402", DATA_VALUE: "1", UNIT_NAME: "x" },
        ]),
      )
      .mockRejectedValueOnce(
        new Error("[ecos] API 에러 INFO-300: 통계코드 없음"),
      );

    const promise = executeCompareIndicators({
      indicators: [
        { code: "A", cycle: "M" },
        { code: "INVALID", cycle: "M" },
      ],
      start: "202402",
      end: "202403",
    });
    await vi.advanceTimersByTimeAsync(300);
    await expect(promise).rejects.toThrow(/INFO-300|통계코드 없음/);
  });

  // ──────────────────────────────────────────────
  // #5 align — 비대칭 시점 → null 표시
  // ──────────────────────────────────────────────
  it("#5 align — 한쪽만 있는 시점은 null 표시 (보간 없음)", async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeEcosResponse([
          { STAT_CODE: "A", STAT_NAME: "A", TIME: "202402", DATA_VALUE: "1", UNIT_NAME: "x" },
          { STAT_CODE: "A", STAT_NAME: "A", TIME: "202403", DATA_VALUE: "2", UNIT_NAME: "x" },
          { STAT_CODE: "A", STAT_NAME: "A", TIME: "202404", DATA_VALUE: "3", UNIT_NAME: "x" },
        ]),
      )
      .mockResolvedValueOnce(
        makeEcosResponse([
          { STAT_CODE: "B", STAT_NAME: "B", TIME: "202403", DATA_VALUE: "10", UNIT_NAME: "y" },
          { STAT_CODE: "B", STAT_NAME: "B", TIME: "202404", DATA_VALUE: "20", UNIT_NAME: "y" },
        ]),
      );

    const promise = executeCompareIndicators({
      indicators: [
        { code: "A", cycle: "M" },
        { code: "B", cycle: "M" },
      ],
      start: "202402",
      end: "202404",
    });
    await vi.advanceTimersByTimeAsync(300);
    const res = await promise;

    assertStandardResponse(res);
    // 공통 기간은 202402, 202403, 202404
    expect(res.data!.aligned_periods).toEqual(["202402", "202403", "202404"]);
    // A는 모두 값 있음
    expect(res.data!.series[0].points.map((p) => p.value)).toEqual([1, 2, 3]);
    // B는 202402가 누락 → null
    expect(res.data!.series[1].points.map((p) => p.value)).toEqual([null, 10, 20]);
    expect(res.meta?.missing_points_total).toBe(1);
    expect(res.warnings![0]).toContain("1개 시점");
  });
});

/**
 * 회귀 테스트 — get_timeseries
 *
 * 시나리오 5건. 환각 방지 5규칙(CONTRIBUTING §1.1) + 시계열 특화 룰 검증.
 *
 *   #1 정상 시계열 3개 row → data 배열 3건 + 표준 4필드 + meta.returned=3 + skipped_null_values=0
 *   #2 모든 DATA_VALUE가 '-' → buildNoData (보간·추측 금지)
 *   #3 일부 DATA_VALUE가 '-' → 유효 row만 반환 + meta.skipped_null_values 정확 + warnings 자동
 *   #4 cycle/period 형식 불일치 (cycle='M', start='20240101' D 형식) → throw (입력 검증 2차)
 *   #5 ECOS 에러 → throw 전파 (빈 응답으로 숨기지 않음)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertStandardResponse,
  makeEcosResponse,
  makeEmptyEcosResponse,
} from "../setup.js";

vi.mock("../../src/lib/ecos.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/ecos.js")>();
  return {
    ...actual,
    fetchEcosStatistic: vi.fn(),
  };
});

import * as ecos from "../../src/lib/ecos.js";
import { executeGetTimeseries } from "../../src/tools/get_timeseries.js";

const mockFetch = vi.mocked(ecos.fetchEcosStatistic);

describe("get_timeseries — 회귀 5건", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    ecos.clearEcosCache();
  });

  // ──────────────────────────────────────────────
  // #1 정상 시계열
  // ──────────────────────────────────────────────
  it("#1 시계열 3 row를 정상 반환 (표준 4필드 + meta.returned=3 + skipped=0)", async () => {
    mockFetch.mockResolvedValueOnce(
      makeEcosResponse([
        { TIME: "202402", DATA_VALUE: "3.5", UNIT_NAME: "%" },
        { TIME: "202403", DATA_VALUE: "3.5", UNIT_NAME: "%" },
        { TIME: "202404", DATA_VALUE: "3.5", UNIT_NAME: "%" },
      ]),
    );

    const res = await executeGetTimeseries({
      indicator_code: "722Y001",
      cycle: "M",
      start: "202402",
      end: "202404",
    });

    assertStandardResponse(res);
    expect(res.data).not.toBeNull();
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data!.length).toBe(3);
    expect(res.data![0].period).toBe("202402");
    expect(res.data![2].period).toBe("202404");
    expect(res.data!.every((p) => p.value === 3.5 && p.unit === "%")).toBe(true);
    expect(res.meta?.returned).toBe(3);
    expect(res.meta?.skipped_null_values).toBe(0);
    // last_updated_at은 마지막 유효 row(202404)의 ISO 변환
    expect(res.last_updated_at).toBe("2024-04-01T00:00:00Z");
  });

  // ──────────────────────────────────────────────
  // #2 전체 DATA_VALUE = "-" → buildNoData
  // ──────────────────────────────────────────────
  it("#2 모든 DATA_VALUE가 '-' 또는 빈값이면 buildNoData (보간·추측 금지)", async () => {
    mockFetch.mockResolvedValueOnce(
      makeEcosResponse([
        { TIME: "202402", DATA_VALUE: "-", UNIT_NAME: "%" },
        { TIME: "202403", DATA_VALUE: "", UNIT_NAME: "%" },
        { TIME: "202404", DATA_VALUE: " ", UNIT_NAME: "%" },
      ]),
    );

    const res = await executeGetTimeseries({
      indicator_code: "722Y001",
      cycle: "M",
      start: "202402",
      end: "202404",
    });

    assertStandardResponse(res, { allowNoData: true });
    expect(res.data).toBeNull();
    expect(res.warnings![0]).toContain("데이터 없음");
  });

  // ──────────────────────────────────────────────
  // #3 일부 빈 값 → skip + meta.skipped_null_values + warnings
  // ──────────────────────────────────────────────
  it("#3 일부 빈 값은 skip하고 유효 row만 반환 + skipped_null_values 정확", async () => {
    mockFetch.mockResolvedValueOnce(
      makeEcosResponse([
        { TIME: "202402", DATA_VALUE: "3.5", UNIT_NAME: "%" },
        { TIME: "202403", DATA_VALUE: "-", UNIT_NAME: "%" },
        { TIME: "202404", DATA_VALUE: "3.5", UNIT_NAME: "%" },
        { TIME: "202405", DATA_VALUE: "", UNIT_NAME: "%" },
        { TIME: "202406", DATA_VALUE: "3.25", UNIT_NAME: "%" },
      ]),
    );

    const res = await executeGetTimeseries({
      indicator_code: "722Y001",
      cycle: "M",
      start: "202402",
      end: "202406",
    });

    assertStandardResponse(res);
    expect(res.data!.length).toBe(3);
    expect(res.data!.map((p) => p.period)).toEqual([
      "202402",
      "202404",
      "202406",
    ]);
    expect(res.meta?.returned).toBe(3);
    expect(res.meta?.skipped_null_values).toBe(2);
    expect(res.warnings).toBeDefined();
    expect(res.warnings![0]).toContain("2건의 빈 값");
    expect(res.warnings![0]).toContain("보간·추측하지 않음");
    // 마지막 유효 row(202406)이 last_updated_at 결정
    expect(res.last_updated_at).toBe("2024-06-01T00:00:00Z");
  });

  // ──────────────────────────────────────────────
  // #4 cycle/period 형식 불일치 → throw
  // ──────────────────────────────────────────────
  it("#4 cycle='M' 인데 start='20240101' (D 형식) 이면 throw — 입력 검증 2차 방어선", async () => {
    await expect(
      executeGetTimeseries({
        indicator_code: "722Y001",
        cycle: "M",
        start: "20240101",
        end: "20240401",
      }),
    ).rejects.toThrow(/period.*cycle.*맞지 않음|YYYYMM/);

    // 네트워크 호출은 일어나면 안 됨 — 형식 검증에서 잘렸어야 함
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // #5 ECOS 에러 → throw 전파
  // ──────────────────────────────────────────────
  it("#5 ECOS 에러 발생 시 throw가 전파되어야 한다 (빈 응답으로 숨기지 않음)", async () => {
    mockFetch.mockRejectedValueOnce(
      new Error("[ecos] API 에러 INFO-200: 일일 호출 한도 초과"),
    );

    await expect(
      executeGetTimeseries({
        indicator_code: "722Y001",
        cycle: "M",
        start: "202401",
        end: "202412",
      }),
    ).rejects.toThrow(/INFO-200|한도/);
  });
});

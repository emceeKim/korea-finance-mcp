/**
 * 회귀 테스트 — get_indicator
 *
 * 시나리오 5건. 모두 환각 방지 5규칙(CONTRIBUTING §1.1) 위반 여부를 코드 수준에서 검증한다.
 *
 *   #1 정상 응답에 표준 4필드(source/source_url/last_updated_at/disclaimer) + data 포함
 *   #2 ECOS row 0건일 때 buildNoData (data:null + warnings)
 *   #3 DATA_VALUE "-" (빈 값) 시 buildNoData (parseEcosValue null 처리)
 *   #4 ECOS RESULT.CODE 에러 시 throw 전파 (try/catch로 빈 응답 만들지 않음)
 *   #5 indicator_code 빈 문자열 시 ZodError (입력 검증 2차 방어선)
 *
 * 본 파일은 다른 도구 회귀 테스트의 표준 패턴이다.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertStandardResponse, makeEcosResponse, makeEmptyEcosResponse } from "../setup.js";

// ECOS 클라이언트 전체를 모킹 — 실제 네트워크 호출 차단
vi.mock("../../src/lib/ecos.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/ecos.js")>();
  return {
    ...actual,
    fetchEcosStatistic: vi.fn(),
  };
});

import * as ecos from "../../src/lib/ecos.js";
import { executeGetIndicator } from "../../src/tools/get_indicator.js";

const mockFetch = vi.mocked(ecos.fetchEcosStatistic);

describe("get_indicator — 회귀 5건", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    ecos.clearEcosCache();
  });

  // ──────────────────────────────────────────────
  // #1 정상 응답 — 표준 4필드 + 데이터
  // ──────────────────────────────────────────────
  it("#1 정상 응답에 표준 4필드와 indicator data가 포함된다", async () => {
    mockFetch.mockResolvedValueOnce(
      makeEcosResponse([
        {
          STAT_CODE: "722Y001",
          STAT_NAME: "한국은행 기준금리",
          TIME: "202504",
          DATA_VALUE: "3.5",
          UNIT_NAME: "%",
        },
      ]),
    );

    const res = await executeGetIndicator({
      indicator_code: "722Y001",
      cycle: "M",
    });

    assertStandardResponse(res);
    expect(res.source).toBe("한국은행 ECOS API");
    expect(res.source_url).toBe("https://ecos.bok.or.kr/api/");
    expect(res.data).not.toBeNull();
    expect(res.data!.indicator_code).toBe("722Y001");
    expect(res.data!.value).toBe(3.5);
    expect(res.data!.unit).toBe("%");
    expect(res.data!.cycle).toBe("M");
    // last_updated_at은 TIME "202504"에서 ISO로 변환되어야 함
    expect(res.last_updated_at).toBe("2025-04-01T00:00:00Z");
  });

  // ──────────────────────────────────────────────
  // #2 rows 0건 → buildNoData
  // ──────────────────────────────────────────────
  it("#2 ECOS row 0건일 때 buildNoData를 반환한다 (data:null + warnings)", async () => {
    mockFetch.mockResolvedValueOnce(makeEmptyEcosResponse());

    const res = await executeGetIndicator({
      indicator_code: "NONEXIST",
      cycle: "M",
    });

    assertStandardResponse(res, { allowNoData: true });
    expect(res.data).toBeNull();
    expect(res.warnings).toBeDefined();
    expect(res.warnings![0]).toContain("데이터 없음");
    expect(res.warnings![0]).toContain("추측하지 않음");
  });

  // ──────────────────────────────────────────────
  // #3 DATA_VALUE "-" → buildNoData (parseEcosValue null)
  // ──────────────────────────────────────────────
  it("#3 DATA_VALUE가 '-' 또는 빈값일 때 buildNoData를 반환한다 (보간·추측 금지)", async () => {
    mockFetch.mockResolvedValueOnce(
      makeEcosResponse([
        {
          STAT_CODE: "722Y001",
          STAT_NAME: "한국은행 기준금리",
          TIME: "202504",
          DATA_VALUE: "-",
          UNIT_NAME: "%",
        },
      ]),
    );

    const res = await executeGetIndicator({
      indicator_code: "722Y001",
      cycle: "M",
    });

    assertStandardResponse(res, { allowNoData: true });
    expect(res.data).toBeNull();
  });

  // ──────────────────────────────────────────────
  // #4 ECOS 에러 시 throw 전파
  // ──────────────────────────────────────────────
  it("#4 ECOS 에러 발생 시 throw가 전파되어야 한다 (빈 응답으로 숨기지 않음)", async () => {
    mockFetch.mockRejectedValueOnce(
      new Error("[ecos] API 에러 INFO-100: 인증키가 유효하지 않습니다"),
    );

    await expect(
      executeGetIndicator({ indicator_code: "722Y001", cycle: "M" }),
    ).rejects.toThrow(/INFO-100|인증키/);
  });

  // ──────────────────────────────────────────────
  // #5 입력 검증 — 빈 indicator_code
  // ──────────────────────────────────────────────
  it("#5 indicator_code가 빈 문자열이면 ZodError로 거부된다", async () => {
    await expect(
      executeGetIndicator({
        // @ts-expect-error - 의도적으로 잘못된 입력
        indicator_code: "",
        cycle: "M",
      }),
    ).rejects.toThrow();
    // 네트워크 호출이 일어나면 안 됨 — Zod에서 잘렸어야 함
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

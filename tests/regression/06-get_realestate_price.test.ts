/**
 * 회귀 re-08 ~ re-13 — get_realestate_price
 *
 * @see wiki/korea-finance-mcp/hallucination-tests.md §6
 * @see wiki/decisions/korea-finance-mcp-realestate-data-policy-2026-W22.md
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("../../src/lib/realestate.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/realestate.js")>();
  return {
    ...actual,
    fetchRtmsTrades: vi.fn(),
  };
});

import {
  executeGetRealEstatePrice,
  GetRealEstatePriceInputSchema,
} from "../../src/tools/get_realestate_price.js";
import { _mockRtmsTrade, fetchRtmsTrades } from "../../src/lib/realestate.js";
import { assertStandardResponse } from "../setup.js";

const mockFetch = vi.mocked(fetchRtmsTrades);

describe("get_realestate_price 회귀 re-08~13", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("re-08: apt 매매 정상 응답 + dong/ho 마스킹 검증 (v1.2: jibun·floor 공개, 정부 RTMS 수준)", async () => {
    mockFetch.mockResolvedValueOnce([
      _mockRtmsTrade({ complex_name: "강남힐스테이트", floor: 12, jibun: "736-8" }),
      _mockRtmsTrade({ complex_name: "타워팰리스", floor: 25, jibun: "100-3" }),
    ]);

    const input = GetRealEstatePriceInputSchema.parse({
      region_code: "11680",
      year_month: "202405",
      property_type: "apt",
    });
    const result = await executeGetRealEstatePrice(input);
    assertStandardResponse(result, { allowNoData: true });

    const data = (result as { data: { trades: Array<Record<string, unknown>>; meta: { data_count: number; region_name: string } } }).data;
    expect(data.meta.region_name).toContain("강남");
    expect(data.meta.data_count).toBe(2);
    // 정부 RTMS 마스킹 정책 — dong/ho는 제거
    expect(data.trades[0]).not.toHaveProperty("dong");
    expect(data.trades[0]).not.toHaveProperty("ho");
    // 정부 RTMS 공개 정책 — jibun/floor는 보존 (v1.2 변경)
    expect(data.trades[0]).toHaveProperty("jibun");
    expect(data.trades[0]).toHaveProperty("floor");
  });

  it("re-09: villa property_type 정상 응답 + 개인정보 필드 차단 (dong/ho만)", async () => {
    mockFetch.mockResolvedValueOnce([_mockRtmsTrade()]);
    const input = GetRealEstatePriceInputSchema.parse({
      region_code: "11440", year_month: "202405", property_type: "villa",
    });
    const result = await executeGetRealEstatePrice(input);
    const data = (result as { data: { trades: Record<string, unknown>[] } }).data;
    expect(data.trades[0]).not.toHaveProperty("dong");
    expect(data.trades[0]).not.toHaveProperty("ho");
  });

  it("re-10: house property_type 정상 응답 + 개인정보 차단 (dong/ho만)", async () => {
    mockFetch.mockResolvedValueOnce([_mockRtmsTrade()]);
    const input = GetRealEstatePriceInputSchema.parse({
      region_code: "26110", year_month: "202405", property_type: "house",
    });
    const result = await executeGetRealEstatePrice(input);
    const data = (result as { data: { trades: Record<string, unknown>[] } }).data;
    expect(data.trades[0]).not.toHaveProperty("dong");
    expect(data.trades[0]).not.toHaveProperty("ho");
  });

  it("re-11: property_type 미지원 enum → ZodError", () => {
    expect(() =>
      GetRealEstatePriceInputSchema.parse({
        region_code: "11680",
        year_month: "202405",
        property_type: "officetel", // 미지원
      }),
    ).toThrow(z.ZodError);
  });

  it("re-12: 빈 결과 → buildNoData 응답", async () => {
    mockFetch.mockResolvedValueOnce([]);
    const input = GetRealEstatePriceInputSchema.parse({
      region_code: "11680", year_month: "202405",
    });
    const result = await executeGetRealEstatePrice(input);
    assertStandardResponse(result, { allowNoData: true });
    expect((result as { data: unknown }).data).toBeNull();
  });

  it("re-13: INFO-200 (no data) → 부분 성공 (warnings + empty)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("INFO-200 해당하는 데이터가 없습니다"));
    const input = GetRealEstatePriceInputSchema.parse({
      region_code: "11680", year_month: "202405",
    });
    const result = await executeGetRealEstatePrice(input);
    assertStandardResponse(result, { allowNoData: true });
    expect((result as { data: unknown }).data).toBeNull();
  });

  it("re-13b: 비-INFO 에러 → throw 전파 (WO-024 패턴)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("HTTP 500 Server Error"));
    const input = GetRealEstatePriceInputSchema.parse({
      region_code: "11680", year_month: "202405",
    });
    await expect(executeGetRealEstatePrice(input)).rejects.toThrow("HTTP 500");
  });

  it("re-16: 잘못된 형식 region_code → ZodError (v1.2: KNOWN_REGIONS 미등록은 허용, 형식만 검증)", async () => {
    // v1.2 (WO-118): 미등록 코드도 형식만 정확하면 RTMS API에 위임.
    // 4자리 같은 *잘못된 형식*만 차단.
    expect(() =>
      GetRealEstatePriceInputSchema.parse({
        region_code: "9999",  // 4자리 = 잘못된 형식
        year_month: "202405",
      }),
    ).toThrow(z.ZodError);
  });

  it("re-17: 미등록 region_code도 통과 (v1.2 WO-118 — 정부 RTMS 수준 확장)", async () => {
    // 99999는 미등록이지만 형식 정확 → 통과. RTMS API가 빈 응답 → INFO-200.
    mockFetch.mockResolvedValueOnce([]); // 미등록 코드 = 데이터 없음
    const input = GetRealEstatePriceInputSchema.parse({
      region_code: "99999",
      year_month: "202405",
    });
    const result = await executeGetRealEstatePrice(input);
    // ZodError 안 던짐. RTMS 빈 응답 → INFO-200 fallback.
    expect(result).toBeDefined();
  });
});

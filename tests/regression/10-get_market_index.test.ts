/**
 * 회귀 st-07 — get_market_index
 *
 * @see wiki/korea-finance-mcp/hallucination-tests.md §7 (v3.0)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("../../src/lib/krx.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/krx.js")>();
  return {
    ...actual,
    fetchKrxMarketIndex: vi.fn(),
  };
});

import {
  executeGetMarketIndex,
  GetMarketIndexInputSchema,
} from "../../src/tools/get_market_index.js";
import { _mockKrxIndex, fetchKrxMarketIndex } from "../../src/lib/krx.js";
import { assertStandardResponse } from "../setup.js";

const mockFetch = vi.mocked(fetchKrxMarketIndex);

describe("get_market_index 회귀 st-07", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("st-07a: KOSPI 정상 응답 + index_name_ko + data_as_of_date", async () => {
    mockFetch.mockResolvedValueOnce([
      _mockKrxIndex({ basDt: "20260522", clpr: 2575.0 }),
      _mockKrxIndex({ basDt: "20260523", clpr: 2580.5 }),
    ]);

    const input = GetMarketIndexInputSchema.parse({ index_code: "KOSPI" });
    const result = await executeGetMarketIndex(input);
    assertStandardResponse(result, { allowNoData: true });

    const meta = (result as { meta: { index_name_ko: string; data_as_of_date: string; total_days: number } }).meta;
    expect(meta.index_name_ko).toBe("코스피");
    expect(meta.data_as_of_date).toBe("20260523");
    expect(meta.total_days).toBe(2);
  });

  it("st-07b: index_code enum 외 값 → ZodError", () => {
    expect(() =>
      GetMarketIndexInputSchema.parse({ index_code: "NASDAQ" } as unknown),
    ).toThrow(z.ZodError);
  });

  it("st-07c: KOSDAQ 정상 호출 (enum 3종 모두 검증)", async () => {
    mockFetch.mockResolvedValueOnce([_mockKrxIndex({ idxNm: "코스닥", clpr: 850.0 })]);
    const input = GetMarketIndexInputSchema.parse({ index_code: "KOSDAQ" });
    const result = await executeGetMarketIndex(input);
    expect((result as { meta: { index_name_ko: string } }).meta.index_name_ko).toBe("코스닥");
  });

  it("st-07d: KOSPI200 정상 호출", async () => {
    mockFetch.mockResolvedValueOnce([_mockKrxIndex({ idxNm: "코스피200", clpr: 340.0 })]);
    const input = GetMarketIndexInputSchema.parse({ index_code: "KOSPI200" });
    const result = await executeGetMarketIndex(input);
    expect((result as { meta: { index_name_ko: string } }).meta.index_name_ko).toBe("코스피200");
  });
});

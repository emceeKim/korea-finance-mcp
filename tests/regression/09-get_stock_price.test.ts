/**
 * 회귀 st-05 ~ st-06 — get_stock_price
 *
 * @see wiki/korea-finance-mcp/hallucination-tests.md §7 (v3.0)
 * @see wiki/korea-finance-mcp/stock-api-research.md §2.3 (data_as_of_date 의무)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("../../src/lib/krx.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/krx.js")>();
  return {
    ...actual,
    fetchKrxStockPrice: vi.fn(),
  };
});

import {
  executeGetStockPrice,
  GetStockPriceInputSchema,
} from "../../src/tools/get_stock_price.js";
import { _mockKrxStock, fetchKrxStockPrice } from "../../src/lib/krx.js";
import { assertStandardResponse } from "../setup.js";

const mockFetch = vi.mocked(fetchKrxStockPrice);

describe("get_stock_price 회귀 st-05~06", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("st-05: 정상 응답 + data_as_of_date 필드 필수", async () => {
    mockFetch.mockResolvedValueOnce([
      _mockKrxStock({ basDt: "20260520", clpr: 79000 }),
      _mockKrxStock({ basDt: "20260523", clpr: 80000 }), // 최신
      _mockKrxStock({ basDt: "20260521", clpr: 79500 }),
    ]);

    const input = GetStockPriceInputSchema.parse({
      ticker: "005930",
      start: "20260501",
      end: "20260531",
    });
    const result = await executeGetStockPrice(input);
    assertStandardResponse(result, { allowNoData: true });

    const meta = (result as { meta: { data_as_of_date: string; total_days: number } }).meta;
    expect(meta.data_as_of_date).toBe("20260523"); // 가장 최신
    expect(meta.total_days).toBe(3);
  });

  it("st-06a: ticker 형식 오류 (6자리 아님) → ZodError", () => {
    expect(() =>
      GetStockPriceInputSchema.parse({ ticker: "ABC123" }),
    ).toThrow(z.ZodError);
    expect(() =>
      GetStockPriceInputSchema.parse({ ticker: "12345" }), // 5자리
    ).toThrow(z.ZodError);
  });

  it("st-06b: 응답에 '실시간/현재가/지금 가격' 키워드 0건", async () => {
    mockFetch.mockResolvedValueOnce([_mockKrxStock()]);
    const input = GetStockPriceInputSchema.parse({ ticker: "005930" });
    const result = await executeGetStockPrice(input);
    const jsonStr = JSON.stringify(result);
    // 우리 메타·warnings·description에 실시간 키워드 절대 X
    expect(jsonStr).not.toMatch(/실시간|현재가|지금 가격|라이브/);
    expect(jsonStr).not.toMatch(/realtime|live price|current price now/i);
  });

  it("st-06c: 빈 결과 → buildNoData + 갱신 시점 안내", async () => {
    mockFetch.mockResolvedValueOnce([]);
    const input = GetStockPriceInputSchema.parse({ ticker: "005930" });
    const result = await executeGetStockPrice(input);
    const r = result as { data: unknown; warnings?: string[] };
    expect(r.data).toBeNull();
    expect(r.warnings?.join("\n")).toContain("영업일 +1");
  });
});

/**
 * 회귀 st-08 — correlate_macro_stock (시너지 1)
 *
 * @see wiki/korea-finance-mcp/hallucination-tests.md §7 (v3.0)
 * @see wiki/korea-finance-mcp/stock-api-research.md §3.1
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("../../src/lib/ecos.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/ecos.js")>();
  return {
    ...actual,
    fetchEcosStatistic: vi.fn(),
  };
});

vi.mock("../../src/lib/krx.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/krx.js")>();
  return {
    ...actual,
    fetchKrxStockPrice: vi.fn(),
  };
});

import {
  executeCorrelateMacroStock,
  CorrelateMacroStockInputSchema,
  MANDATORY_NOTES_MS,
} from "../../src/tools/correlate_macro_stock.js";
import { fetchEcosStatistic } from "../../src/lib/ecos.js";
import { _mockKrxStock, fetchKrxStockPrice } from "../../src/lib/krx.js";
import { assertStandardResponse } from "../setup.js";

const mockEcos = vi.mocked(fetchEcosStatistic);
const mockKrx = vi.mocked(fetchKrxStockPrice);

describe("correlate_macro_stock 회귀 st-08", () => {
  beforeEach(() => {
    mockEcos.mockReset();
    mockKrx.mockReset();
  });

  it("st-08a: 정상 상관 응답 + MANDATORY_NOTES 4건 포함", async () => {
    // ECOS macro 12개월 (월간)
    const macroRows = Array.from({ length: 12 }, (_, i) => ({
      STAT_CODE: "722Y001",
      STAT_NAME: "한국은행 기준금리",
      ITEM_CODE1: "0101000",
      ITEM_NAME1: "한국은행 기준금리",
      TIME: `2025${String(i + 1).padStart(2, "0")}`,
      DATA_VALUE: String(3 + i * 0.05),
      UNIT_NAME: "연%",
    }));
    mockEcos.mockResolvedValueOnce({
      StatisticSearch: { row: macroRows, list_total_count: 12 },
    } as unknown as Awaited<ReturnType<typeof fetchEcosStatistic>>);

    // KRX 일간 (월별 평균이 macro와 유사한 추세)
    const krxRows = [];
    for (let m = 1; m <= 18; m++) {
      for (let d = 1; d <= 20; d++) {
        krxRows.push(
          _mockKrxStock({
            basDt: `2025${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`,
            clpr: 80000 + m * 500,
          }),
        );
      }
    }
    mockKrx.mockResolvedValueOnce(krxRows);

    const input = CorrelateMacroStockInputSchema.parse({
      macro_code: "722Y001",
      ticker: "005930",
      start: "2025-01",
      end: "2026-06",
      lag_months: 6,
    });
    const result = await executeCorrelateMacroStock(input);
    assertStandardResponse(result);

    const data = (result as { data: { correlation: number; notes: readonly string[] } }).data;
    expect(typeof data.correlation).toBe("number");
    expect(data.notes).toHaveLength(4);
    expect(data.notes).toEqual([...MANDATORY_NOTES_MS]);
  });

  it("st-08b: 미등록 macro_code → ZodError (추측 금지)", async () => {
    const input = CorrelateMacroStockInputSchema.parse({
      macro_code: "ZZZ_FAKE",
      ticker: "005930",
      start: "2025-01",
      end: "2026-06",
    });
    await expect(executeCorrelateMacroStock(input)).rejects.toThrow(z.ZodError);
  });

  it("st-08c: ticker 형식 오류 → ZodError", () => {
    expect(() =>
      CorrelateMacroStockInputSchema.parse({
        macro_code: "722Y001",
        ticker: "005",
        start: "2025-01",
        end: "2026-06",
      }),
    ).toThrow(z.ZodError);
  });

  it("st-08d: 응답에 *능동* '인과/예측/추천' 키워드 0건 (notes의 *부정문* 제외)", async () => {
    mockEcos.mockResolvedValueOnce({ StatisticSearch: { row: [], list_total_count: 0 } } as unknown as Awaited<ReturnType<typeof fetchEcosStatistic>>);
    mockKrx.mockResolvedValueOnce([]);
    const input = CorrelateMacroStockInputSchema.parse({
      macro_code: "722Y001",
      ticker: "005930",
      start: "2025-01",
      end: "2026-06",
    });
    const result = await executeCorrelateMacroStock(input);
    const jsonStr = JSON.stringify(result);
    // *능동 동사형* 인과·예측·추천 표현만 차단. 부정문 (예: "예측이 아닙니다") 은 *환각 차단 증거*이므로 허용.
    expect(jsonStr).not.toMatch(/인과 관계가 있다|예측합니다|전망합니다|추천합니다|목표주가는 \d/);
    // notes에 "인과 관계를 의미하지 않습니다"는 *반드시* 포함 (부정문 = 환각 차단)
    expect(jsonStr).toContain("인과 관계를 의미하지 않습니다");
    expect(jsonStr).toContain("예측·전망·추천");
  });
});

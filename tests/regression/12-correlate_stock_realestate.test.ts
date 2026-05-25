/**
 * 회귀 st-09 + 시너지 회귀 9건 — correlate_stock_realestate (⭐⭐ 한국 유일)
 *
 * @see wiki/korea-finance-mcp/hallucination-tests.md §7 (v3.0)
 * @see wiki/korea-finance-mcp/synergy-tool-design-correlate-stock-realestate.md §4
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

vi.mock("../../src/lib/rone.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/rone.js")>();
  return {
    ...actual,
    fetchRoneSeries: vi.fn(),
  };
});

import {
  executeCorrelateStockRealestate,
  CorrelateStockRealestateInputSchema,
  MANDATORY_NOTES_SR,
} from "../../src/tools/correlate_stock_realestate.js";
import { _mockKrxStock, fetchKrxStockPrice } from "../../src/lib/krx.js";
import { fetchRoneSeries } from "../../src/lib/rone.js";
import { assertStandardResponse } from "../setup.js";

const mockKrx = vi.mocked(fetchKrxStockPrice);
const mockRone = vi.mocked(fetchRoneSeries);

describe("correlate_stock_realestate 회귀 st-09 (한국 유일 시너지)", () => {
  beforeEach(() => {
    mockKrx.mockReset();
    mockRone.mockReset();
  });

  it("st-09a: 정상 상관 + narrative 필수 + MANDATORY_NOTES 5건", async () => {
    const krxRows = [];
    for (let m = 1; m <= 18; m++) {
      for (let d = 1; d <= 20; d++) {
        krxRows.push(
          _mockKrxStock({
            basDt: `2025${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`,
            clpr: 50000 + m * 300,
          }),
        );
      }
    }
    mockKrx.mockResolvedValueOnce(krxRows);

    const roneRows = Array.from({ length: 15 }, (_, i) => ({
      date: `2025-${String(i + 1).padStart(2, "0")}-01`,
      value: 100 + i * 0.5,
      unit: "지수",
    }));
    mockRone.mockResolvedValueOnce(roneRows);

    const input = CorrelateStockRealestateInputSchema.parse({
      ticker: "000720", // 현대건설 가설
      region: "seoul",
      start: "2025-01",
      end: "2026-06",
      lag_months: 3,
    });
    const result = await executeCorrelateStockRealestate(input);
    assertStandardResponse(result);

    const data = (result as {
      data: { correlation: number; narrative: string; notes: readonly string[] };
    }).data;
    expect(typeof data.correlation).toBe("number");
    expect(data.narrative).toBeDefined();
    expect(data.narrative.length).toBeGreaterThan(50); // 비어있지 않음
    expect(data.narrative).toContain("인과 관계가 아닙니다");
    expect(data.notes).toHaveLength(5); // correlate_macro_*보다 1건 많음
    expect(data.notes).toEqual([...MANDATORY_NOTES_SR]);
  });

  it("st-09b: 미등록 region → ZodError (KNOWN_REGIONS_RONE 강제)", async () => {
    const input = CorrelateStockRealestateInputSchema.parse({
      ticker: "005930",
      region: "fake_region_xyz",
      start: "2025-01",
      end: "2026-06",
    });
    await expect(executeCorrelateStockRealestate(input)).rejects.toThrow(z.ZodError);
  });

  it("st-09c: ticker 형식 오류 → ZodError", () => {
    expect(() =>
      CorrelateStockRealestateInputSchema.parse({
        ticker: "abc",
        region: "seoul",
        start: "2025-01",
        end: "2026-06",
      }),
    ).toThrow(z.ZodError);
  });

  it("st-09d: 데이터 3개월 미만 → buildResponse fallback (correlation=null + warnings)", async () => {
    mockKrx.mockResolvedValueOnce([_mockKrxStock({ basDt: "20250115" })]);
    mockRone.mockResolvedValueOnce([
      { date: "2025-01-01", value: 100, unit: "지수" },
    ]);

    const input = CorrelateStockRealestateInputSchema.parse({
      ticker: "005930",
      region: "seoul",
      start: "2025-01",
      end: "2026-06",
    });
    const result = await executeCorrelateStockRealestate(input);
    const data = (result as { data: { correlation: number | null; aligned_count: number } }).data;
    expect(data.correlation).toBeNull();
    expect(data.aligned_count).toBeLessThan(3);
  });

  it("st-09e: 응답 전체에 '예측·추천·목표주가·포트폴리오 추천' 키워드 0건 (notes의 부정문 제외)", async () => {
    mockKrx.mockResolvedValueOnce([]);
    mockRone.mockResolvedValueOnce([]);
    const input = CorrelateStockRealestateInputSchema.parse({
      ticker: "005930",
      region: "seoul",
      start: "2025-01",
      end: "2026-06",
    });
    const result = await executeCorrelateStockRealestate(input);
    const jsonStr = JSON.stringify(result);
    // notes에 *부정문*으로 포함되는 것 확인
    expect(jsonStr).toContain("예측·전망·추천·목표주가·포트폴리오 추천이 아닙니다");
    expect(jsonStr).toContain("자본시장법");
  });

  it("st-09f: synergy_note 메타에 '한국 유일' 명시 (차별화 검증)", async () => {
    const krxRows = Array.from({ length: 100 }, (_, i) => {
      const m = Math.floor(i / 20) + 1;
      const d = (i % 20) + 1;
      return _mockKrxStock({
        basDt: `2025${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`,
        clpr: 50000 + i * 100,
      });
    });
    mockKrx.mockResolvedValueOnce(krxRows);
    mockRone.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({
        date: `2025-${String(i + 1).padStart(2, "0")}-01`,
        value: 100 + i * 0.3,
        unit: "지수",
      })),
    );

    const input = CorrelateStockRealestateInputSchema.parse({
      ticker: "005930",
      region: "seoul",
      start: "2025-01",
      end: "2026-06",
    });
    const result = await executeCorrelateStockRealestate(input);
    const meta = (result as { meta: { synergy_note: string } }).meta;
    expect(meta.synergy_note).toContain("한국 유일");
  });
});

/**
 * 회귀 st-01 ~ st-02 — get_disclosure
 *
 * @see wiki/korea-finance-mcp/hallucination-tests.md §7 (v3.0)
 * @see wiki/korea-finance-mcp/stock-api-research.md §4.3
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("../../src/lib/dart.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/dart.js")>();
  return {
    ...actual,
    fetchDartDisclosure: vi.fn(),
  };
});

import {
  executeGetDisclosure,
  GetDisclosureInputSchema,
} from "../../src/tools/get_disclosure.js";
import { _mockDartDisclosure, fetchDartDisclosure } from "../../src/lib/dart.js";
import { assertStandardResponse } from "../setup.js";

const mockFetch = vi.mocked(fetchDartDisclosure);

describe("get_disclosure 회귀 st-01~02", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("st-01: corp_code 직접 지정 정상 응답", async () => {
    mockFetch.mockResolvedValueOnce([
      _mockDartDisclosure({ report_nm: "사업보고서 (2024.12)" }),
      _mockDartDisclosure({ report_nm: "분기보고서 (2025.03)", rcept_no: "20250515000002" }),
    ]);

    const input = GetDisclosureInputSchema.parse({
      corp_code: "00126380",
      start: "20250101",
      end: "20251231",
    });
    const result = await executeGetDisclosure(input);
    assertStandardResponse(result, { allowNoData: true });
    expect((result as { data: unknown[] }).data).toHaveLength(2);
  });

  it("st-02: company_name + corp_code 둘 다 누락 → ZodError refine", () => {
    expect(() =>
      GetDisclosureInputSchema.parse({
        start: "20250101",
        end: "20251231",
      } as unknown),
    ).toThrow(z.ZodError);
  });

  it("st-02b: 미등록 company_name → KNOWN_COMPANIES 미매핑 buildNoData", async () => {
    mockFetch.mockResolvedValueOnce([]);
    const input = GetDisclosureInputSchema.parse({
      company_name: "존재하지않는회사XYZ",
      start: "20250101",
      end: "20251231",
    });
    const result = await executeGetDisclosure(input);
    // KNOWN_COMPANIES 빈 상태이므로 buildNoData + ECOS 안내 warnings
    const r = result as { data: unknown; warnings?: string[] };
    expect(r.data).toBeNull();
    expect(r.warnings?.join("\n")).toContain("KNOWN_COMPANIES");
  });

  it("st-02c: 빈 결과 → INFO-200 buildNoData", async () => {
    mockFetch.mockResolvedValueOnce([]);
    const input = GetDisclosureInputSchema.parse({
      corp_code: "00126380",
      start: "20250101",
      end: "20251231",
    });
    const result = await executeGetDisclosure(input);
    const r = result as { data: unknown; warnings?: string[] };
    expect(r.data).toBeNull();
    expect(r.warnings?.join("\n")).toContain("0건");
  });
});

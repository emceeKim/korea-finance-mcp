/**
 * 회귀 st-03 ~ st-04 — get_financials
 *
 * @see wiki/korea-finance-mcp/hallucination-tests.md §7 (v3.0)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("../../src/lib/dart.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/dart.js")>();
  return {
    ...actual,
    fetchDartFinancials: vi.fn(),
  };
});

import {
  executeGetFinancials,
  GetFinancialsInputSchema,
} from "../../src/tools/get_financials.js";
import { fetchDartFinancials, type DartFinancialItem } from "../../src/lib/dart.js";
import { assertStandardResponse } from "../setup.js";

const mockFetch = vi.mocked(fetchDartFinancials);

function mockAccount(overrides: Partial<DartFinancialItem> = {}): DartFinancialItem {
  return {
    rcept_no: "20250318000001",
    reprt_code: "11011",
    bsns_year: "2024",
    corp_code: "00126380",
    sj_div: "BS",
    sj_nm: "재무상태표",
    account_id: "ifrs-full_Assets",
    account_nm: "자산총계",
    account_detail: "-",
    thstrm_nm: "제56기",
    thstrm_dt: "2024.12.31 현재",
    thstrm_amount: "455905830000000",
    thstrm_add_amount: "",
    frmtrm_nm: "제55기",
    frmtrm_dt: "2023.12.31 현재",
    frmtrm_amount: "448424507000000",
    frmtrm_add_amount: "",
    bfefrmtrm_nm: "제54기",
    bfefrmtrm_dt: "2022.12.31 현재",
    bfefrmtrm_amount: "426621158000000",
    ord: "1",
    currency: "KRW",
    ...overrides,
  };
}

describe("get_financials 회귀 st-03~04", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("st-03: 사업보고서 정상 응답 (annual + CFS)", async () => {
    mockFetch.mockResolvedValueOnce([
      mockAccount(),
      mockAccount({ account_nm: "매출액", sj_div: "IS", sj_nm: "손익계산서" }),
    ]);

    const input = GetFinancialsInputSchema.parse({
      corp_code: "00126380",
      year: 2024,
      report_type: "annual",
      consolidated: true,
    });
    const result = await executeGetFinancials(input);
    assertStandardResponse(result, { allowNoData: true });
    expect((result as { data: unknown[] }).data).toHaveLength(2);
  });

  it("st-04a: corp_code 형식 오류 → ZodError", () => {
    expect(() =>
      GetFinancialsInputSchema.parse({
        corp_code: "123",
        year: 2024,
        report_type: "annual",
      }),
    ).toThrow(z.ZodError);
  });

  it("st-04b: 응답에 '좋다/나쁘다/투자 적합' 등 가공 평가 키워드 0건 (raw passthrough)", async () => {
    mockFetch.mockResolvedValueOnce([mockAccount()]);
    const input = GetFinancialsInputSchema.parse({
      corp_code: "00126380",
      year: 2024,
      report_type: "annual",
    });
    const result = await executeGetFinancials(input);
    const jsonStr = JSON.stringify(result);
    // 우리 도구는 *원문 그대로* 전달. 가공 평가 키워드가 우리 메타·warnings에 절대 없어야.
    expect(jsonStr).not.toMatch(/투자 적합|투자 부적합|사야 한다|팔아야 한다/);
    expect(jsonStr).not.toMatch(/good buy|good sell|investment grade|junk/i);
  });

  it("st-04c: 빈 결과 → buildNoData + 사업보고서 안내", async () => {
    mockFetch.mockResolvedValueOnce([]);
    const input = GetFinancialsInputSchema.parse({
      corp_code: "00126380",
      year: 2024,
      report_type: "annual",
    });
    const result = await executeGetFinancials(input);
    const r = result as { data: unknown; warnings?: string[] };
    expect(r.data).toBeNull();
    expect(r.warnings?.join("\n")).toContain("사업보고서");
  });
});

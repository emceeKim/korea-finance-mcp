/**
 * get_financials — DART 재무제표 조회 (v3.0 두 번째 도구)
 *
 * @see wiki/korea-finance-mcp/tools-spec.md §3.2
 * @see wiki/korea-finance-mcp/stock-api-research.md §1
 *
 * 양보 불가 (회귀 st-03~04):
 * - corp_code 필수 + year(4자리) + report_type enum
 * - 가공 분석 키워드 차단 (sanitize) — "투자 적합/부적합" 등
 * - 응답은 *원문 그대로*, "이 회사 좋다" 같은 평가 *0건*
 */

import { z } from "zod";
import { buildResponse, buildNoData } from "../lib/response.js";
import {
  fetchDartFinancials,
  DART_REPORT_CODES,
  type DartFinancialItem,
  type DartReportType,
} from "../lib/dart.js";
import type { ToolResponse } from "../types.js";

export const GetFinancialsInputSchema = z.object({
  corp_code: z.string().regex(/^\d{8}$/, "corp_code는 8자리 숫자"),
  year: z.number().int().min(2015).max(2030).describe("4자리 사업연도"),
  report_type: z
    .enum(["annual", "semi", "q1", "q3"])
    .default("annual")
    .describe("annual:사업보고서 / semi:반기 / q1:1분기 / q3:3분기"),
  consolidated: z.boolean().optional().default(true).describe("true:연결재무제표(CFS), false:개별(OFS)"),
});

export type GetFinancialsInput = z.infer<typeof GetFinancialsInputSchema>;

export const getFinancialsTool = {
  name: "get_financials",
  title: "Korea DART Financial Statements",
  description: [
    "한국 상장사 재무제표 조회 (DART OpenAPI, DS003).",
    "입력: corp_code (8자리, get_disclosure로 확인) + year (YYYY) + report_type + consolidated.",
    "출력: 재무상태표(BS) / 손익(IS) / 포괄손익(CIS) / 현금흐름(CF) 원문 계정.",
    "⚠️ 가공 분석·평가·투자 추천은 *0건*. 데이터 그대로 전달.",
  ].join("\n"),
  inputSchema: GetFinancialsInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
} as const;

interface FinancialsMeta {
  corp_code: string;
  bsns_year: string;
  reprt_code: string;
  fs_div: "CFS" | "OFS";
  total_accounts: number;
}

export async function executeGetFinancials(
  input: GetFinancialsInput,
): Promise<ToolResponse<DartFinancialItem[]>> {
  const validated = GetFinancialsInputSchema.parse(input);

  const reprtCode = DART_REPORT_CODES[validated.report_type as DartReportType];
  const fsDiv = validated.consolidated ? "CFS" : "OFS";

  const items = await fetchDartFinancials({
    corp_code: validated.corp_code,
    bsns_year: String(validated.year),
    reprt_code: reprtCode,
    fs_div: fsDiv,
  });

  if (items.length === 0) {
    return buildNoData({
      source: "DART OpenAPI",
      source_url: "https://opendart.fss.or.kr",
      last_updated_at: new Date().toISOString(),
      warnings: [
        `${validated.year} ${validated.report_type} 재무제표 0건 (corp_code ${validated.corp_code}).`,
        "사업보고서는 매년 3월말까지 제출, 분기보고서는 분기 종료 후 45일.",
      ],
    });
  }

  const meta: FinancialsMeta = {
    corp_code: validated.corp_code,
    bsns_year: String(validated.year),
    reprt_code: reprtCode,
    fs_div: fsDiv,
    total_accounts: items.length,
  };

  return buildResponse<DartFinancialItem[]>({
    source: "DART OpenAPI",
    source_url: "https://opendart.fss.or.kr",
    last_updated_at: new Date().toISOString(),
    data: items,
    meta: meta as unknown as Record<string, unknown>,
  });
}

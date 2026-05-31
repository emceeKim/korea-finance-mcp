/**
 * get_executive_holdings — DART 임원·주요주주 소유 보고 (DS004)
 *
 * v1.1 신규 (WO-112). 자본시장법 §148·149에 따라 공시된 *임원·주요주주 보유 변동* 조회.
 * 등록 임원·주요주주(10% 이상)의 특정증권 등 보유·변동 공시 데이터.
 *
 * @see wiki/korea-finance-mcp/tools-spec.md §3.6
 * @see https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS004&apiId=2019021
 *
 * 양보 불가:
 * - company_name 또는 corp_code 둘 중 하나 필수
 * - KNOWN_COMPANIES 정적 사전 매핑 (추측 금지 WO-018)
 * - *조회만* — 인사이드 트레이딩·매도 예고 등 해석 키워드 차단
 */

import { z } from "zod";
import { buildResponse, buildNoData } from "../lib/response.js";
import {
  fetchDartExecutiveStock,
  type DartExecutiveStockItem,
} from "../lib/dart.js";
import { findCompanyByName } from "../lib/stock-dictionaries.js";
import type { ToolResponse } from "../types.js";

export const GetExecutiveHoldingsInputSchema = z
  .object({
    company_name: z
      .string()
      .optional()
      .describe("회사명 (KNOWN_COMPANIES 사전 매핑). corp_code와 둘 중 하나는 필수."),
    corp_code: z
      .string()
      .regex(/^\d{8}$/, "corp_code는 8자리 숫자")
      .optional()
      .describe("DART 회사 고유번호 (8자리). company_name 대안."),
    limit: z.number().int().min(1).max(100).optional().default(20),
  })
  .refine((d) => d.company_name || d.corp_code, {
    message: "company_name 또는 corp_code 둘 중 하나는 필수",
    path: ["company_name"],
  });

export type GetExecutiveHoldingsInput = z.infer<
  typeof GetExecutiveHoldingsInputSchema
>;

export const getExecutiveHoldingsTool = {
  name: "get_executive_holdings",
  title: "Korea DART Executive & Major Shareholder Holdings",
  description: [
    "한국 상장사 *임원·주요주주 소유 보고* 조회 (DART DS004, 자본시장법 §148·149).",
    "등록 임원·주요주주(10% 이상)의 특정증권 등 보유·변동 공시.",
    "입력: company_name (KNOWN_COMPANIES) 또는 corp_code (8자리).",
    "출력: 공시 원본 — 보고자명·임원 직위·주주 여부·보유 수량·변동 비율.",
    "⚠️ '인사이드 정보·매도 예고·임박' 등 해석 응답 금지.",
  ].join("\n"),
  inputSchema: GetExecutiveHoldingsInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
} as const;

interface ExecutiveHoldingsMeta {
  resolved_corp_code: string | null;
  resolved_corp_name: string | null;
  total_returned: number;
  legal_basis: string;
}

export async function executeGetExecutiveHoldings(
  input: GetExecutiveHoldingsInput,
): Promise<ToolResponse<DartExecutiveStockItem[]>> {
  const validated = GetExecutiveHoldingsInputSchema.parse(input);

  // 1) company_name → corp_code 매핑
  let corpCode = validated.corp_code;
  let corpName: string | null = null;
  if (!corpCode && validated.company_name) {
    const known = findCompanyByName(validated.company_name);
    if (!known || !known.corp_code) {
      return buildNoData({
        source: "DART OpenAPI",
        source_url: "https://opendart.fss.or.kr",
        last_updated_at: new Date().toISOString(),
        warnings: [
          `'${validated.company_name}'은 KNOWN_COMPANIES 사전에서 corp_code를 찾을 수 없습니다.`,
          "DART에서 corp_code(8자리)를 확인 후 직접 입력하세요: https://opendart.fss.or.kr/disclosureinfo/company/main.do",
        ],
      });
    }
    corpCode = known.corp_code;
    corpName = known.name_ko;
  }

  // 2) DART elestock 호출
  const items = await fetchDartExecutiveStock({
    corp_code: corpCode!,
  });

  if (items.length === 0) {
    return buildNoData({
      source: "DART OpenAPI",
      source_url: "https://opendart.fss.or.kr",
      last_updated_at: new Date().toISOString(),
      warnings: [
        `회사 ${corpName ?? corpCode}의 임원·주요주주 보고 0건`,
      ],
    });
  }

  const sliced = items.slice(0, validated.limit);
  const meta: ExecutiveHoldingsMeta = {
    resolved_corp_code: corpCode ?? null,
    resolved_corp_name: corpName,
    total_returned: sliced.length,
    legal_basis: "자본시장법 §148·149 (임원·주요주주 보고 의무)",
  };

  return buildResponse<DartExecutiveStockItem[]>({
    source: "DART OpenAPI",
    source_url: "https://opendart.fss.or.kr",
    last_updated_at: new Date().toISOString(),
    data: sliced,
    meta: meta as unknown as Record<string, unknown>,
  });
}

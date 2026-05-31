/**
 * get_major_holdings — DART 대량보유 상황 보고 (DS004, 5% 룰)
 *
 * v1.1 신규 (WO-112). 자본시장법 §147에 따라 공시된 *대량보유 상황 보고* 조회.
 * 어떤 종목에 5% 이상 지분을 보유한 자(투자자·기관)의 공시 데이터.
 *
 * @see wiki/korea-finance-mcp/tools-spec.md §3.5
 * @see wiki/decisions/korea-finance-mcp-stock-data-policy-2026-W30.md
 * @see https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS004&apiId=2019004
 *
 * 양보 불가:
 * - company_name 또는 corp_code 둘 중 하나 필수
 * - KNOWN_COMPANIES 정적 사전 매핑 (추측 금지 WO-018)
 * - *조회만* — 해석·예측·"임박" 키워드 차단 (sanitize)
 */

import { z } from "zod";
import { buildResponse, buildNoData } from "../lib/response.js";
import {
  fetchDartMajorStock,
  type DartMajorStockItem,
} from "../lib/dart.js";
import { findCompanyByName } from "../lib/stock-dictionaries.js";
import type { ToolResponse } from "../types.js";

export const GetMajorHoldingsInputSchema = z
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

export type GetMajorHoldingsInput = z.infer<typeof GetMajorHoldingsInputSchema>;

export const getMajorHoldingsTool = {
  name: "get_major_holdings",
  title: "Korea DART Major Shareholders (5% Rule)",
  description: [
    "한국 상장사 *대량보유 상황 보고* 조회 (DART DS004, 자본시장법 §147 5% 룰).",
    "5% 이상 지분 보유자의 공시 데이터 — 보고자명·보유 비율·보유 수량·보고 사유.",
    "입력: company_name (KNOWN_COMPANIES) 또는 corp_code (8자리).",
    "출력: 공시 원본 데이터. 예측·해석 X.",
    "⚠️ '임박·전망·매수 추천' 등 예측 키워드 응답 금지 (회귀 st-04 적용).",
  ].join("\n"),
  inputSchema: GetMajorHoldingsInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
} as const;

interface MajorHoldingsMeta {
  resolved_corp_code: string | null;
  resolved_corp_name: string | null;
  total_returned: number;
  legal_basis: string;
}

export async function executeGetMajorHoldings(
  input: GetMajorHoldingsInput,
): Promise<ToolResponse<DartMajorStockItem[]>> {
  const validated = GetMajorHoldingsInputSchema.parse(input);

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

  // 2) DART majorstock 호출
  const items = await fetchDartMajorStock({
    corp_code: corpCode!,
  });

  if (items.length === 0) {
    return buildNoData({
      source: "DART OpenAPI",
      source_url: "https://opendart.fss.or.kr",
      last_updated_at: new Date().toISOString(),
      warnings: [`회사 ${corpName ?? corpCode}의 대량보유 공시 0건`],
    });
  }

  const sliced = items.slice(0, validated.limit);
  const meta: MajorHoldingsMeta = {
    resolved_corp_code: corpCode ?? null,
    resolved_corp_name: corpName,
    total_returned: sliced.length,
    legal_basis: "자본시장법 §147 (대량보유 보고 의무)",
  };

  return buildResponse<DartMajorStockItem[]>({
    source: "DART OpenAPI",
    source_url: "https://opendart.fss.or.kr",
    last_updated_at: new Date().toISOString(),
    data: sliced,
    meta: meta as unknown as Record<string, unknown>,
  });
}

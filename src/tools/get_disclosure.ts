/**
 * get_disclosure — DART 공시 목록 조회 (v3.0 첫 도구)
 *
 * @see wiki/korea-finance-mcp/tools-spec.md §3.1
 * @see wiki/decisions/korea-finance-mcp-stock-data-policy-2026-W30.md
 * @see wiki/korea-finance-mcp/stock-api-research.md §1
 *
 * 양보 불가 (회귀 st-01~02):
 * - company_name 또는 corp_code 둘 중 하나는 필수 (둘 다 없으면 ZodError)
 * - KNOWN_COMPANIES 정적 사전 매핑 (추측 금지 WO-018)
 * - 가공 분석 키워드 차단 (sanitize, 회귀 st-04)
 */

import { z } from "zod";
import { buildResponse, buildNoData } from "../lib/response.js";
import {
  fetchDartDisclosure,
  type DartDisclosureItem,
} from "../lib/dart.js";
import { findCompanyByName } from "../lib/stock-dictionaries.js";
import type { ToolResponse } from "../types.js";

export const GetDisclosureInputSchema = z
  .object({
    company_name: z.string().optional().describe("회사명 (KNOWN_COMPANIES 사전 매핑). corp_code와 둘 중 하나는 필수."),
    corp_code: z
      .string()
      .regex(/^\d{8}$/, "corp_code는 8자리 숫자")
      .optional()
      .describe("DART 회사 고유번호 (8자리). company_name 대안."),
    start: z.string().regex(/^\d{8}$/, "YYYYMMDD"),
    end: z.string().regex(/^\d{8}$/, "YYYYMMDD"),
    report_type: z
      .enum(["A", "B", "C", "D", "E"])
      .optional()
      .describe("A:정기보고서 / B:주요사항 / C:발행 / D:지분 / E:기타. 미지정 시 전체"),
    limit: z.number().int().min(1).max(100).optional().default(20),
  })
  .refine((d) => d.company_name || d.corp_code, {
    message: "company_name 또는 corp_code 둘 중 하나는 필수",
    path: ["company_name"],
  });

export type GetDisclosureInput = z.infer<typeof GetDisclosureInputSchema>;

export const getDisclosureTool = {
  name: "get_disclosure",
  title: "Korea DART Disclosure Filings",
  description: [
    "한국 상장사 공시 목록 조회 (DART OpenAPI, DS001+DS002+DS005).",
    "입력: company_name (KNOWN_COMPANIES) 또는 corp_code (8자리). start/end (YYYYMMDD).",
    "출력: 공시명·접수일·접수번호·제출인 등 원문 데이터.",
    "⚠️ 가공 분석 (좋다/나쁘다/투자 적합 등) 금지. 데이터 그대로 전달.",
  ].join("\n"),
  inputSchema: GetDisclosureInputSchema,
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
} as const;

interface DisclosureMeta {
  resolved_corp_code: string | null;
  resolved_corp_name: string | null;
  date_range: { start: string; end: string };
  total_returned: number;
}

export async function executeGetDisclosure(
  input: GetDisclosureInput,
): Promise<ToolResponse<DartDisclosureItem[]>> {
  const validated = GetDisclosureInputSchema.parse(input);

  // 1) company_name → corp_code 매핑
  let corpCode = validated.corp_code;
  let corpName: string | null = null;
  if (!corpCode && validated.company_name) {
    const known = findCompanyByName(validated.company_name);
    if (!known) {
      // 추측 금지 — 사전 매핑 실패 시 사용자에게 corp_code 직접 입력 안내
      return buildNoData({
        source: "DART OpenAPI",
        source_url: "https://opendart.fss.or.kr",
        last_updated_at: new Date().toISOString(),
        warnings: [
          `'${validated.company_name}'은 KNOWN_COMPANIES 사전에 없습니다.`,
          "DART에서 corp_code(8자리)를 확인 후 직접 입력하세요: https://opendart.fss.or.kr/disclosureinfo/company/main.do",
        ],
      });
    }
    corpCode = known.corp_code;
    corpName = known.name_ko;
  }

  // 2) DART 호출
  const items = await fetchDartDisclosure({
    corp_code: corpCode,
    bgn_de: validated.start,
    end_de: validated.end,
    pblntf_ty: validated.report_type,
    page_count: validated.limit,
  });

  if (items.length === 0) {
    return buildNoData({
      source: "DART OpenAPI",
      source_url: "https://opendart.fss.or.kr",
      last_updated_at: new Date().toISOString(),
      warnings: [`기간 ${validated.start}~${validated.end} 공시 0건`],
    });
  }

  const meta: DisclosureMeta = {
    resolved_corp_code: corpCode ?? null,
    resolved_corp_name: corpName,
    date_range: { start: validated.start, end: validated.end },
    total_returned: items.length,
  };

  return buildResponse<DartDisclosureItem[]>({
    source: "DART OpenAPI",
    source_url: "https://opendart.fss.or.kr",
    last_updated_at: new Date().toISOString(),
    data: items,
    meta: meta as unknown as Record<string, unknown>,
  });
}

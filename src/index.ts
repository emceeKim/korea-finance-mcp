/**
 * korea-finance-mcp — MCP Server Entry
 *
 * 모든 도구는 이 파일에서 등록한다.
 * 새 도구 추가 시:
 *   1. `src/tools/<tool_name>.ts` 작성 (`get_indicator.ts` 패턴 복제)
 *   2. 아래 imports에 추가
 *   3. `registerTools()` 함수의 배열에 추가
 *
 * @see CONTRIBUTING.md §도구 1개 추가 5단계
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { config } from "dotenv";

import { serializeForMcp } from "./lib/response.js";
import { withMetrics } from "./lib/operational-metrics.js";
import {
  getIndicatorTool,
  executeGetIndicator,
  GetIndicatorInputSchema,
} from "./tools/get_indicator.js";
import {
  searchIndicatorTool,
  executeSearchIndicator,
  SearchIndicatorInputSchema,
} from "./tools/search_indicator.js";
import {
  getTimeseriesTool,
  executeGetTimeseries,
  GetTimeseriesInputSchema,
} from "./tools/get_timeseries.js";
import {
  compareIndicatorsTool,
  executeCompareIndicators,
  CompareIndicatorsInputSchema,
} from "./tools/compare_indicators.js";
import {
  getDashboardTool,
  executeGetDashboard,
  GetDashboardInputSchema,
} from "./tools/get_dashboard.js";
import {
  getRealEstatePriceTool,
  executeGetRealEstatePrice,
  GetRealEstatePriceInputSchema,
} from "./tools/get_realestate_price.js";
import {
  getHousingIndexTool,
  executeGetHousingIndex,
  GetHousingIndexInputSchema,
} from "./tools/get_housing_index.js";
import {
  getJeonseRatioTool,
  executeGetJeonseRatio,
  GetJeonseRatioInputSchema,
} from "./tools/get_jeonse_ratio.js";
import {
  correlateMacroRealestateTool,
  executeCorrelateMacroRealestate,
  CorrelateMacroRealestateInputSchema,
} from "./tools/correlate_macro_realestate.js";
// WO-090~093: v3.0 주식 6 도구
import {
  getDisclosureTool,
  executeGetDisclosure,
  GetDisclosureInputSchema,
} from "./tools/get_disclosure.js";
import {
  getFinancialsTool,
  executeGetFinancials,
  GetFinancialsInputSchema,
} from "./tools/get_financials.js";
import {
  getStockPriceTool,
  executeGetStockPrice,
  GetStockPriceInputSchema,
} from "./tools/get_stock_price.js";
import {
  getMarketIndexTool,
  executeGetMarketIndex,
  GetMarketIndexInputSchema,
} from "./tools/get_market_index.js";
import {
  correlateMacroStockTool,
  executeCorrelateMacroStock,
  CorrelateMacroStockInputSchema,
} from "./tools/correlate_macro_stock.js";
import {
  correlateStockRealestateTool,
  executeCorrelateStockRealestate,
  CorrelateStockRealestateInputSchema,
} from "./tools/correlate_stock_realestate.js";
// WO-112: v1.1 — DART DS004 지분공시 2 도구 추가
import {
  getMajorHoldingsTool,
  executeGetMajorHoldings,
  GetMajorHoldingsInputSchema,
} from "./tools/get_major_holdings.js";
import {
  getExecutiveHoldingsTool,
  executeGetExecutiveHoldings,
  GetExecutiveHoldingsInputSchema,
} from "./tools/get_executive_holdings.js";
// v1.3: 부동산 추세 시계열 — 18번째 도구
import {
  trackApartmentTrendTool,
  executeTrackApartmentTrend,
  TrackApartmentTrendInputSchema,
} from "./tools/track_apartment_trend.js";
// v1.4 (WO-124): 회사명 → corp_code 검색 — 19번째 도구
import {
  searchCompanyTool,
  executeSearchCompany,
  SearchCompanyInputSchema,
} from "./tools/search_company.js";

// ============================================================
// 환경변수 로드 (.env)
// ============================================================
config();

// ============================================================
// 도구 레지스트리 — 새 도구는 여기에 추가
// ============================================================
interface ToolDefinition {
  name: string;
  title?: string; // WO-085: Anthropic Directory 필수
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (input: unknown) => Promise<unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    openWorldHint?: boolean;
    idempotentHint?: boolean;
  };
}

const TOOLS: ToolDefinition[] = [
  {
    name: getIndicatorTool.name,
    title: getIndicatorTool.title,
    description: getIndicatorTool.description,
    inputSchema: getIndicatorTool.inputSchema,
    annotations: getIndicatorTool.annotations,
    execute: async (input) =>
      executeGetIndicator(GetIndicatorInputSchema.parse(input)),
  },
  {
    name: searchIndicatorTool.name,
    title: searchIndicatorTool.title,
    description: searchIndicatorTool.description,
    inputSchema: searchIndicatorTool.inputSchema,
    annotations: searchIndicatorTool.annotations,
    execute: async (input) =>
      executeSearchIndicator(SearchIndicatorInputSchema.parse(input)),
  },
  {
    name: getTimeseriesTool.name,
    title: getTimeseriesTool.title,
    description: getTimeseriesTool.description,
    inputSchema: getTimeseriesTool.inputSchema,
    annotations: getTimeseriesTool.annotations,
    execute: async (input) =>
      executeGetTimeseries(GetTimeseriesInputSchema.parse(input)),
  },
  {
    name: compareIndicatorsTool.name,
    title: compareIndicatorsTool.title,
    description: compareIndicatorsTool.description,
    inputSchema: compareIndicatorsTool.inputSchema,
    annotations: compareIndicatorsTool.annotations,
    execute: async (input) =>
      executeCompareIndicators(CompareIndicatorsInputSchema.parse(input)),
  },
  {
    name: getDashboardTool.name,
    title: getDashboardTool.title,
    description: getDashboardTool.description,
    inputSchema: getDashboardTool.inputSchema,
    annotations: getDashboardTool.annotations,
    execute: async (input) =>
      executeGetDashboard(GetDashboardInputSchema.parse(input)),
  },
  {
    name: getRealEstatePriceTool.name,
    title: getRealEstatePriceTool.title,
    description: getRealEstatePriceTool.description,
    inputSchema: getRealEstatePriceTool.inputSchema,
    annotations: getRealEstatePriceTool.annotations,
    execute: async (input) =>
      executeGetRealEstatePrice(GetRealEstatePriceInputSchema.parse(input)),
  },
  {
    name: getHousingIndexTool.name,
    title: getHousingIndexTool.title,
    description: getHousingIndexTool.description,
    inputSchema: getHousingIndexTool.inputSchema,
    annotations: getHousingIndexTool.annotations,
    execute: async (input) =>
      executeGetHousingIndex(GetHousingIndexInputSchema.parse(input)),
  },
  {
    name: getJeonseRatioTool.name,
    title: getJeonseRatioTool.title,
    description: getJeonseRatioTool.description,
    inputSchema: getJeonseRatioTool.inputSchema,
    annotations: getJeonseRatioTool.annotations,
    execute: async (input) =>
      executeGetJeonseRatio(GetJeonseRatioInputSchema.parse(input)),
  },
  {
    name: correlateMacroRealestateTool.name,
    title: correlateMacroRealestateTool.title,
    description: correlateMacroRealestateTool.description,
    inputSchema: correlateMacroRealestateTool.inputSchema,
    annotations: correlateMacroRealestateTool.annotations,
    execute: async (input) =>
      executeCorrelateMacroRealestate(CorrelateMacroRealestateInputSchema.parse(input)),
  },
  // WO-090~093: v3.0 주식 6 도구 (15/15 완성)
  {
    name: getDisclosureTool.name,
    title: getDisclosureTool.title,
    description: getDisclosureTool.description,
    inputSchema: getDisclosureTool.inputSchema,
    annotations: getDisclosureTool.annotations,
    execute: async (input) =>
      executeGetDisclosure(GetDisclosureInputSchema.parse(input)),
  },
  {
    name: getFinancialsTool.name,
    title: getFinancialsTool.title,
    description: getFinancialsTool.description,
    inputSchema: getFinancialsTool.inputSchema,
    annotations: getFinancialsTool.annotations,
    execute: async (input) =>
      executeGetFinancials(GetFinancialsInputSchema.parse(input)),
  },
  {
    name: getStockPriceTool.name,
    title: getStockPriceTool.title,
    description: getStockPriceTool.description,
    inputSchema: getStockPriceTool.inputSchema,
    annotations: getStockPriceTool.annotations,
    execute: async (input) =>
      executeGetStockPrice(GetStockPriceInputSchema.parse(input)),
  },
  {
    name: getMarketIndexTool.name,
    title: getMarketIndexTool.title,
    description: getMarketIndexTool.description,
    inputSchema: getMarketIndexTool.inputSchema,
    annotations: getMarketIndexTool.annotations,
    execute: async (input) =>
      executeGetMarketIndex(GetMarketIndexInputSchema.parse(input)),
  },
  {
    name: correlateMacroStockTool.name,
    title: correlateMacroStockTool.title,
    description: correlateMacroStockTool.description,
    inputSchema: correlateMacroStockTool.inputSchema,
    annotations: correlateMacroStockTool.annotations,
    execute: async (input) =>
      executeCorrelateMacroStock(CorrelateMacroStockInputSchema.parse(input)),
  },
  {
    name: correlateStockRealestateTool.name,
    title: correlateStockRealestateTool.title,
    description: correlateStockRealestateTool.description,
    inputSchema: correlateStockRealestateTool.inputSchema,
    annotations: correlateStockRealestateTool.annotations,
    execute: async (input) =>
      executeCorrelateStockRealestate(CorrelateStockRealestateInputSchema.parse(input)),
  },
  // 🎉 v3.0 주식 6/6 완성 (2026-05-25). **15/15 도구**.
  // 시너지 2종 (correlate_macro_stock + correlate_stock_realestate ⭐⭐ 한국 유일) 포함.
  // ============================================================
  // v1.1 (2026-05-31 WO-112) — DART DS004 지분공시 2 도구 추가 = 17/17
  // 자본시장법 §147 (5% 룰) + §148·149 (임원·주요주주). *조회만*, 해석 X.
  // ============================================================
  {
    name: getMajorHoldingsTool.name,
    title: getMajorHoldingsTool.title,
    description: getMajorHoldingsTool.description,
    inputSchema: getMajorHoldingsTool.inputSchema,
    annotations: getMajorHoldingsTool.annotations,
    execute: async (input) =>
      executeGetMajorHoldings(GetMajorHoldingsInputSchema.parse(input)),
  },
  {
    name: getExecutiveHoldingsTool.name,
    title: getExecutiveHoldingsTool.title,
    description: getExecutiveHoldingsTool.description,
    inputSchema: getExecutiveHoldingsTool.inputSchema,
    annotations: getExecutiveHoldingsTool.annotations,
    execute: async (input) =>
      executeGetExecutiveHoldings(GetExecutiveHoldingsInputSchema.parse(input)),
  },
  // v1.3 — track_apartment_trend (RTMS 월 순회 시계열). 17 → 18 도구.
  // 과거 실거래 집계만, 해석·전망 0건 (자본시장법 영구 잠금).
  {
    name: trackApartmentTrendTool.name,
    title: trackApartmentTrendTool.title,
    description: trackApartmentTrendTool.description,
    inputSchema: trackApartmentTrendTool.inputSchema,
    annotations: trackApartmentTrendTool.annotations,
    execute: async (input) =>
      executeTrackApartmentTrend(TrackApartmentTrendInputSchema.parse(input)),
  },
  // v1.4 (WO-124) — search_company. 18 → 19 도구. KNOWN_COMPANIES 한계 해소.
  {
    name: searchCompanyTool.name,
    title: searchCompanyTool.title,
    description: searchCompanyTool.description,
    inputSchema: searchCompanyTool.inputSchema,
    annotations: searchCompanyTool.annotations,
    execute: async (input) =>
      executeSearchCompany(SearchCompanyInputSchema.parse(input)),
  },
];

// ============================================================
// MCP Server
// ============================================================
const server = new Server(
  {
    name: "korea-finance-mcp",
    version: "1.4.0", // WO-124: v1.4 — track_apartment_trend(18) + search_company(19)
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// list_tools 핸들러
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.name,
    ...(t.title && { title: t.title }), // WO-085 Anthropic Directory 필수
    description: t.description,
    inputSchema: zodToJsonSchema(t.inputSchema),
    ...(t.annotations && { annotations: t.annotations }), // WO-085
  })),
}));

// call_tool 핸들러
server.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) {
    throw new Error(`[mcp] Unknown tool: ${req.params.name}`);
  }
  try {
    const input = req.params.arguments ?? {};
    const sid = (extra as { sessionId?: string } | undefined)?.sessionId;
    const result = await withMetrics(
      tool.name,
      extractKeywords(tool.name, input),
      () => tool.execute(input),
      { sessionId: sid, clientType: "stdio" },
    );
    // result는 ToolResponse<T> 형태 — serializeForMcp로 변환
    return serializeForMcp(result as Parameters<typeof serializeForMcp>[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text" as const,
          text: `❌ 도구 실행 오류: ${message}\n\n공식 사이트에서 직접 확인 권장.`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================
// 운영 메트릭 키워드 추출 (v1.2) — 공개정보만 (지역·매물·종목·지표). 사용자 식별 정보 0.
// 규약: [[korea-finance-mcp/realestate-demand-collection-design]] §2
// ============================================================
function extractKeywords(name: string, input: unknown): string[] {
  const i = (input ?? {}) as Record<string, unknown>;
  const s = (v: unknown): string | null =>
    v === undefined || v === null || v === "" ? null : String(v);
  let keys: (string | null)[];
  switch (name) {
    case "get_realestate_price":
      keys = [s(i.region_code), s(i.property_type) ?? "apt"];
      break;
    case "track_apartment_trend":
      keys = [s(i.region_code), s(i.apt_name), s(i.property_type) ?? "apt", s(i.area)];
      break;
    case "get_housing_index":
    case "get_jeonse_ratio":
      keys = [s(i.region)];
      break;
    case "correlate_macro_realestate":
      keys = [s(i.region), s(i.macro_code)];
      break;
    case "get_indicator":
    case "get_timeseries":
      keys = [s(i.indicator_code)];
      break;
    case "search_indicator":
      keys = [s(i.query)];
      break;
    case "compare_indicators":
      keys = Array.isArray(i.indicator_codes)
        ? (i.indicator_codes as unknown[]).map((x) => String(x))
        : [];
      break;
    case "get_stock_price":
    case "correlate_macro_stock":
      keys = [s(i.ticker)];
      break;
    case "correlate_stock_realestate":
      keys = [s(i.ticker), s(i.region)];
      break;
    case "search_company":
      keys = [s(i.query) ?? s(i.name)];
      break;
    case "get_disclosure":
    case "get_financials":
    case "get_major_holdings":
    case "get_executive_holdings":
      keys = [s(i.corp_code) ?? s(i.corp_name) ?? s(i.company)];
      break;
    default:
      keys = [];
  }
  return keys.filter((k): k is string => Boolean(k));
}

// ============================================================
// Zod → JSON Schema (간이 변환 — MCP 표준 응답용)
// ============================================================
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // v0.x: Zod 스키마를 JSON Schema로 정밀 변환하는 라이브러리는 v0.2에서 도입.
  // 현재는 도구 description에 입력 설명을 충분히 담아 우회.
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = {
        type: zodTypeName(value),
        description: value.description ?? "",
      };
      if (!value.isOptional()) required.push(key);
    }
    return {
      type: "object",
      properties,
      required,
    };
  }
  return { type: "object" };
}

function zodTypeName(s: z.ZodTypeAny): string {
  if (s instanceof z.ZodString) return "string";
  if (s instanceof z.ZodNumber) return "number";
  if (s instanceof z.ZodBoolean) return "boolean";
  if (s instanceof z.ZodEnum) return "string";
  if (s instanceof z.ZodOptional) return zodTypeName(s.unwrap());
  if (s instanceof z.ZodDefault) return zodTypeName(s.removeDefault());
  return "string";
}

// ============================================================
// Bootstrap
// ============================================================
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[korea-finance-mcp] server v0.2.0 running — ${TOOLS.length} tool(s) registered\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[korea-finance-mcp] fatal: ${err}\n`);
  process.exit(1);
});

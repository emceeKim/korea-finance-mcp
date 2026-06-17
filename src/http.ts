/**
 * korea-finance-mcp — HTTP (Streamable) Server Entry
 *
 * 용도: Fly.io 등 원격 호스팅. Claude Desktop / IDE 등은 stdio (src/index.ts)를 그대로 사용.
 *
 * 통념파괴: stdio→HTTP *전환*이 아니라 **이중 entry**.
 *   - src/index.ts → StdioServerTransport (로컬, Claude Desktop)
 *   - src/http.ts  → StreamableHTTPServerTransport (원격, Fly.io)
 *   회귀 위험 0. 도구 등록 로직은 buildServer()로 공유.
 *
 * @see CONTRIBUTING.md §배포 (v0.4)
 * @see wiki/korea-finance-mcp/work-orders.md WO-027
 */

import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  isInitializeRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { config } from "dotenv";
import rateLimit from "express-rate-limit"; // WO-086 Phase 2: DoS 방어

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
// 환경변수 로드
// ============================================================
config();

// ============================================================
// 도구 레지스트리 — src/index.ts와 동일 (의도적 중복, v0.5에서 lib/registry.ts로 분리 예정)
// ============================================================
interface ToolDefinition {
  name: string;
  title?: string;
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
  // v1.1 (WO-112) — DART DS004 지분공시 2 도구. 15 → 17 도구
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
  {
    name: trackApartmentTrendTool.name,
    title: trackApartmentTrendTool.title,
    description: trackApartmentTrendTool.description,
    inputSchema: trackApartmentTrendTool.inputSchema,
    annotations: trackApartmentTrendTool.annotations,
    execute: async (input) =>
      executeTrackApartmentTrend(TrackApartmentTrendInputSchema.parse(input)),
  },
  // v1.4 (WO-124) — search_company. 18 → 19 도구.
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
// MCP Server 빌더 (요청마다 신규 인스턴스 — stateless 모드)
// ============================================================
function buildServer(): Server {
  const server = new Server(
    { name: "korea-finance-mcp", version: "1.4.0" }, // WO-124: v1.4 — track_apartment_trend(18) + search_company(19)
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      ...(t.title && { title: t.title }),
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
      ...(t.annotations && { annotations: t.annotations }),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = TOOLS.find((t) => t.name === req.params.name);
    if (!tool) {
      throw new Error(`[mcp] Unknown tool: ${req.params.name}`);
    }
    try {
      const input = req.params.arguments ?? {};
      const result = await withMetrics(
        tool.name,
        extractKeywords(tool.name, input),
        () => tool.execute(input),
      );
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

  return server;
}

// ============================================================
// 운영 메트릭 키워드 추출 — 공개정보만 (지역·매물·종목·지표). 사용자 식별 정보 0.
// 규약: [[korea-finance-mcp/realestate-demand-collection-design]] §2
// ============================================================
function extractKeywords(name: string, input: unknown): string[] {
  const i = (input ?? {}) as Record<string, unknown>;
  const s = (v: unknown): string | null =>
    v === undefined || v === null || v === "" ? null : String(v);
  let keys: (string | null)[];
  switch (name) {
    // 부동산 (설계서 §2 규약)
    case "get_realestate_price":
      keys = [s(i.region_code), s(i.property_type)];
      break;
    case "track_apartment_trend":
      keys = [s(i.region_code), s(i.apt_name), s(i.property_type), s(i.area)];
      break;
    case "get_housing_index":
    case "get_jeonse_ratio":
      keys = [s(i.region)];
      break;
    case "correlate_macro_realestate":
      keys = [s(i.region), s(i.macro_code)];
      break;
    // 거시
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
    // 주식·공시
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
// Zod → JSON Schema (src/index.ts와 동일)
// ============================================================
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
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
    return { type: "object", properties, required };
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
// Express 핸들러 시그니처 (외부 @types/express 없이 빌드 통과용 최소 타입)
// ============================================================
type ExpressRequest = IncomingMessage & { body?: unknown };
interface ExpressResponse extends ServerResponse {
  status: (code: number) => ExpressResponse;
  json: (body: unknown) => ExpressResponse;
  headersSent: boolean;
}

// ============================================================
// HTTP Bootstrap
// ============================================================
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "0.0.0.0"; // Fly.io는 0.0.0.0 필수
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main(): Promise<void> {
  const app = createMcpExpressApp({
    host: HOST,
    allowedHosts: ALLOWED_HOSTS.length > 0 ? ALLOWED_HOSTS : undefined,
  });

  // WO-110 핫픽스: Fly.io 프록시 (1-hop) 신뢰 → X-Forwarded-For로 실제 사용자 IP 식별
  //   미설정 시 express-rate-limit이 모든 요청을 같은 IP로 합산 → 분산 공격 0방어
  //   '1' = Fly.io 프록시만 신뢰 (true는 너무 관대해 IP 스푸핑 위험)
  app.set("trust proxy", 1);

  // 헬스체크 — Fly.io 헬스체크용
  app.get("/healthz", (_req: unknown, res: ExpressResponse) => {
    res.status(200).json({
      status: "ok",
      service: "korea-finance-mcp",
      version: "1.4.0", // WO-124: v1.4 동기화
      tools: TOOLS.length,
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================================
  // MCP endpoint — *stateful* 모드 (공식 SDK simpleStreamableHttp 예제 패턴)
  //
  // 통념파괴: stateless로 가는 게 "단순"해 보이지만, SDK 1.29의 모든 메이저 클라이언트
  //   (Anthropic Cowork / Claude Desktop / MCP Inspector / Cursor)는 *stateful sessionId 핸드셰이크*를
  //   기대한다. stateless는 빈 도구 목록(또는 400)로 보이는 사일런트 실패를 만든다.
  //
  // 패턴:
  //   1) POST /mcp + isInitializeRequest → 신규 transport + onsessioninitialized로 맵에 저장
  //   2) POST /mcp + Mcp-Session-Id 헤더 → 맵에서 transport 재사용
  //   3) GET /mcp (SSE) + Mcp-Session-Id → transport.handleRequest로 위임
  //   4) DELETE /mcp + Mcp-Session-Id → 세션 종료
  //
  // @see node_modules/@modelcontextprotocol/sdk/dist/esm/examples/server/simpleStreamableHttp.js
  // @see wiki/korea-finance-mcp/work-orders.md WO-069 (stateful) + WO-086 (security)
  // ============================================================
  const transports: Record<string, StreamableHTTPServerTransport> = {};
  const sessionTimers = new Map<string, NodeJS.Timeout>(); // WO-086: 세션 max age timer

  // WO-086 Phase 2: 세션 max age — 30분 미사용 시 자동 정리 (메모리 누수 방지)
  const SESSION_MAX_AGE_MS = 30 * 60 * 1000;
  const scheduleSessionTimeout = (sid: string): void => {
    // 기존 timer 정리 (재호출 시 갱신)
    const old = sessionTimers.get(sid);
    if (old) clearTimeout(old);
    const timer = setTimeout(() => {
      const t = transports[sid];
      if (t) {
        process.stderr.write(`[http] session ${sid} timeout (30 min) — auto-cleanup\n`);
        t.close().catch(() => {});
        delete transports[sid];
        sessionTimers.delete(sid);
      }
    }, SESSION_MAX_AGE_MS);
    sessionTimers.set(sid, timer);
  };

  // WO-086 Phase 2: Rate limit — /mcp만 (헬스체크 제외)
  //   기본 30 req/분/IP (정상 사용자 평균 ~5-10/분 보호 + DoS 방어)
  //   429 응답은 JSON-RPC 표준 에러 형식 사용
  const mcpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_PER_MIN ?? 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      jsonrpc: "2.0",
      error: { code: -32029, message: "Rate limit exceeded — 30 req/min/IP. Please retry shortly." },
      id: null,
    },
    // /healthz는 적용 안 됨 (별도 라우트)
  });

  // POST — JSON-RPC 메시지 (initialize / tools/list / tools/call / 기타)
  app.post("/mcp", mcpLimiter, async (req: ExpressRequest, res: ExpressResponse) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        // 기존 세션 재사용 + max age 타이머 갱신 (WO-121: 주석 의도 "30분 *미사용* 시"와 일치하도록 sliding 갱신)
        transport = transports[sessionId];
        scheduleSessionTimeout(sessionId);
      } else if (sessionId && !transports[sessionId]) {
        // WO-121 핫픽스: 서버 재시작·만료로 *소실된* 세션 → MCP 스펙상 404 의무
        //   (스펙: "404 수신 시 클라이언트는 MUST 새 InitializeRequest로 세션 재시작")
        //   기존 400 응답은 클라이언트 자동 복구를 차단 → 배포 때마다 Cowork 등
        //   모든 클라이언트가 "Tool execution failed"로 멈추고 수동 재연결 필요했음.
        res.status(404).json({
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message: "Session not found — expired or server restarted. Re-initialize required.",
          },
          id: null,
        });
        return;
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // 신규 initialize — transport 생성 + 세션 발급 시 맵에 등록
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => {
            transports[sid] = transport;
            scheduleSessionTimeout(sid); // WO-086: 30분 max age
          },
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            delete transports[sid];
            // WO-086: timer 정리
            const timer = sessionTimers.get(sid);
            if (timer) {
              clearTimeout(timer);
              sessionTimers.delete(sid);
            }
          }
        };
        const server = buildServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        // 세션 없는데 initialize도 아님 → 표준 거부 응답
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: No valid session ID provided" },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[http] /mcp POST error: ${errMsg}\n`);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // GET — SSE 스트림 (서버 → 클라이언트 알림 채널)
  app.get("/mcp", mcpLimiter, async (req: ExpressRequest, res: ExpressResponse) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid or missing session ID" },
        id: null,
      });
      return;
    }
    if (!transports[sessionId]) {
      // WO-121: 소실 세션 → 404 (클라이언트 재초기화 유도, POST와 동일 정책)
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Session not found — re-initialize required." },
        id: null,
      });
      return;
    }
    try {
      await transports[sessionId].handleRequest(req, res);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[http] /mcp GET error: ${errMsg}\n`);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // DELETE — 세션 종료
  app.delete("/mcp", mcpLimiter, async (req: ExpressRequest, res: ExpressResponse) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid or missing session ID" },
        id: null,
      });
      return;
    }
    if (!transports[sessionId]) {
      // WO-121: 소실 세션 → 404. DELETE는 "이미 없음" = 사실상 종료 완료이나
      //   스펙 일관성 위해 404 유지 (클라이언트는 다음 요청에서 재초기화)
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Session not found — re-initialize required." },
        id: null,
      });
      return;
    }
    try {
      await transports[sessionId].handleRequest(req, res);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[http] /mcp DELETE error: ${errMsg}\n`);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.listen(PORT, HOST, () => {
    process.stderr.write(
      `[korea-finance-mcp:http] v0.2.0 listening on http://${HOST}:${PORT} — ${TOOLS.length} tool(s)\n`,
    );
  });
}

main().catch((err) => {
  process.stderr.write(`[korea-finance-mcp:http] fatal: ${err}\n`);
  process.exit(1);
});

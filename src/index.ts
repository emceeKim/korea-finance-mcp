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

// ============================================================
// 환경변수 로드 (.env)
// ============================================================
config();

// ============================================================
// 도구 레지스트리 — 새 도구는 여기에 추가
// ============================================================
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (input: unknown) => Promise<unknown>;
}

const TOOLS: ToolDefinition[] = [
  {
    name: getIndicatorTool.name,
    description: getIndicatorTool.description,
    inputSchema: getIndicatorTool.inputSchema,
    execute: async (input) =>
      executeGetIndicator(GetIndicatorInputSchema.parse(input)),
  },
  {
    name: searchIndicatorTool.name,
    description: searchIndicatorTool.description,
    inputSchema: searchIndicatorTool.inputSchema,
    execute: async (input) =>
      executeSearchIndicator(SearchIndicatorInputSchema.parse(input)),
  },
  // 👇 새 도구는 이 아래에 추가
  // Layer A 잔여: get_timeseries / compare_indicators / get_dashboard
];

// ============================================================
// MCP Server
// ============================================================
const server = new Server(
  {
    name: "korea-finance-mcp",
    version: "0.1.0",
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
    description: t.description,
    inputSchema: zodToJsonSchema(t.inputSchema),
  })),
}));

// call_tool 핸들러
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) {
    throw new Error(`[mcp] Unknown tool: ${req.params.name}`);
  }
  try {
    const result = await tool.execute(req.params.arguments ?? {});
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
    `[korea-finance-mcp] server v0.1.0 running — ${TOOLS.length} tool(s) registered\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[korea-finance-mcp] fatal: ${err}\n`);
  process.exit(1);
});

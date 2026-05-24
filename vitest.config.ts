/**
 * korea-finance-mcp — Vitest 설정
 *
 * 회귀 테스트(tests/regression/**)와 단위 테스트(tests/unit/**)를 모두 처리.
 * 환각 방지 5규칙(CONTRIBUTING §1.1)을 코드 레벨에서 강제하는 1차 방어선.
 *
 * @see CONTRIBUTING.md §환각 방지 5규칙
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 테스트 파일 위치 — tests/ 하위 모든 .test.ts
    include: ["tests/**/*.test.ts"],

    // 환경 — Node (MCP 서버는 Node 환경에서만 작동)
    environment: "node",

    // 글로벌 setup — 환경변수 주입 + fetch 모킹 헬퍼
    setupFiles: ["./tests/setup.ts"],

    // 타임아웃 — ECOS는 가끔 느림. 회귀 테스트는 모킹 기반이므로 짧게.
    testTimeout: 10_000,

    // 격리 — 각 테스트 파일은 별도 컨텍스트 (cache 충돌 방지)
    isolate: true,

    // 정확한 실패 위치 출력
    reporters: ["verbose"],

    // 환각 방지 — 한 테스트라도 실패하면 즉시 중단 (CI/PR 차단 목적)
    bail: 0, // 0 = 끝까지 실행 (로컬 개발), CI에서는 npm 옵션으로 1 강제 가능

    // 커버리지(향후 v0.3)
    // coverage: { provider: "v8", reporter: ["text", "html"] },
  },
});

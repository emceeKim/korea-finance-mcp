/**
 * 회귀 st-10 ~ st-14 — v3.0 통합 키워드 차단 + INFO-200 일반화
 *
 * 모든 v3.0 도구의 *코드 자체*가 영구 금지 키워드를 *반환하지 않음* 검증.
 * description에 *부정문*으로 포함되는 것은 허용 (의도적 차단 명시).
 *
 * @see wiki/korea-finance-mcp/excluded-tools.md §7.2
 * @see wiki/korea-finance-mcp/hallucination-tests.md §7 (v3.0)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TOOL_FILES = [
  "src/tools/get_disclosure.ts",
  "src/tools/get_financials.ts",
  "src/tools/get_stock_price.ts",
  "src/tools/get_market_index.ts",
  "src/tools/correlate_macro_stock.ts",
  "src/tools/correlate_stock_realestate.ts",
];

const LIB_FILES = ["src/lib/dart.ts", "src/lib/krx.ts"];

function readSrc(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf-8");
}

describe("v3.0 통합 키워드 차단 st-10~14", () => {
  // ============================================================
  // st-10: "예측" 키워드 차단 — 도구 *반환값* 생성 코드에 없어야
  // ============================================================
  it("st-10: 코드에 능동적 '예측/forecast' 표현 0건 (부정문 제외)", () => {
    for (const file of [...TOOL_FILES, ...LIB_FILES]) {
      const src = readSrc(file);
      // 능동적 예측 표현 검출 — *not.* / *부정문* 패턴 제외
      const activePrediction = /(?<!안\s)(?<!못\s)(?<!아닙니다.*)(예측합니다|forecast\s*\=|will\s+rise|will\s+fall|will\s+be)/gi;
      const matches = src.match(activePrediction);
      expect(matches, `${file}에 능동 예측 표현 발견: ${matches?.join(", ")}`).toBeNull();
    }
  });

  // ============================================================
  // st-11: "추천" 키워드 차단
  // ============================================================
  it("st-11: 코드에 능동적 '추천/recommend' 표현 0건", () => {
    for (const file of [...TOOL_FILES, ...LIB_FILES]) {
      const src = readSrc(file);
      const activeRecommend = /(?<!안\s)(?<!못\s)(추천합니다|should\s+buy|should\s+sell|recommended\s+stock)/gi;
      const matches = src.match(activeRecommend);
      expect(matches, `${file}에 능동 추천 표현: ${matches?.join(", ")}`).toBeNull();
    }
  });

  // ============================================================
  // st-12: "목표주가" 키워드 차단
  // ============================================================
  it("st-12: 코드에 능동적 '목표주가/target price' 계산 0건", () => {
    for (const file of TOOL_FILES) {
      const src = readSrc(file);
      // target_price = ... / 목표주가 = ... 같은 능동 할당
      const activeTargetPrice = /target_price\s*[:=]\s*[^/]/gi;
      const matches = src.match(activeTargetPrice);
      expect(matches, `${file}에 target_price 능동 할당: ${matches?.join(", ")}`).toBeNull();
    }
  });

  // ============================================================
  // st-13: "포트폴리오 최적화" 차단
  // ============================================================
  it("st-13: 코드에 'optimize_portfolio/포트폴리오 최적화' 함수 0건", () => {
    for (const file of TOOL_FILES) {
      const src = readSrc(file);
      // 함수 정의/호출 패턴
      const activeOptimize = /(function|const|let|var)\s+optimize_?[Pp]ortfolio\s*[=(]/g;
      const matches = src.match(activeOptimize);
      expect(matches, `${file}에 포트폴리오 최적화 함수: ${matches?.join(", ")}`).toBeNull();
    }
  });

  // ============================================================
  // st-14: INFO-200 catch 패턴 (WO-024 일반화) — 모든 lib에 적용
  // ============================================================
  it("st-14: lib 파일에 INFO-200/에러 catch 패턴 존재 (WO-024 일관성)", () => {
    for (const file of LIB_FILES) {
      const src = readSrc(file);
      // INFO-200 또는 status 코드 분기 처리 패턴 (DART "013", KRX "03" 또는 INFO-200)
      const hasInfoCatch = /INFO-200|status\s*===?\s*"013"|resultCode\s*===?\s*"03"/i.test(src);
      expect(hasInfoCatch, `${file}에 INFO-200 catch 패턴 없음`).toBe(true);
    }
  });

  // ============================================================
  // 보조: 모든 v3.0 도구가 readOnlyHint: true 명시 (WO-085 일관성)
  // ============================================================
  it("WO-085 일관성: 모든 v3.0 도구가 readOnlyHint: true + openWorldHint: false", () => {
    for (const file of TOOL_FILES) {
      const src = readSrc(file);
      expect(src, `${file}에 readOnlyHint: true 누락`).toContain("readOnlyHint: true");
      expect(src, `${file}에 openWorldHint: false 누락`).toContain("openWorldHint: false");
    }
  });

  // ============================================================
  // 보조: 시너지 도구 2개에 MANDATORY_NOTES export 존재
  // ============================================================
  it("시너지 도구에 MANDATORY_NOTES_MS / MANDATORY_NOTES_SR export 존재", () => {
    const macroStock = readSrc("src/tools/correlate_macro_stock.ts");
    const stockRe = readSrc("src/tools/correlate_stock_realestate.ts");
    expect(macroStock).toContain("MANDATORY_NOTES_MS");
    expect(stockRe).toContain("MANDATORY_NOTES_SR");
    // 시너지 2번이 시너지 1번보다 1건 더 (5 vs 4)
    const msCount = (macroStock.match(/^\s*".*?\.",\s*$/gm) ?? []).length;
    const srCount = (stockRe.match(/^\s*".*?\.",\s*$/gm) ?? []).length;
    expect(srCount).toBeGreaterThan(msCount);
  });
});

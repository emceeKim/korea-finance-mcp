/**
 * 회귀 테스트 — search_indicator
 *
 * 시나리오 5건. v0.1 정적 사전 기반 도구의 환각 방지·입력 검증·경계 동작 검증.
 *
 *   #1 정상 매칭: '기준금리' 검색 → 722Y001 반환 + 표준 4필드 + 데이터
 *   #2 미적중: 사전에 없는 키워드 → buildNoData + ECOS 공식 검색 URL 안내
 *   #3 limit 경계: limit=1 적용, limit=51 거부 (Zod max)
 *   #4 query 빈 문자열 → ZodError
 *   #5 정규화: 영문·공백·대소문자 무관 매칭 ('USD/KRW' → 731Y001)
 */

import { describe, expect, it } from "vitest";
import { assertStandardResponse } from "../setup.js";
import {
  executeSearchIndicator,
  KNOWN_INDICATORS,
} from "../../src/tools/search_indicator.js";

describe("search_indicator — 회귀 5건", () => {
  // ──────────────────────────────────────────────
  // #1 정상 매칭
  // ──────────────────────────────────────────────
  it("#1 '기준금리' 검색 시 722Y001을 반환하고 표준 4필드가 포함된다", async () => {
    const res = await executeSearchIndicator({ query: "기준금리", limit: 10 });

    assertStandardResponse(res);
    expect(res.data).not.toBeNull();
    expect(Array.isArray(res.data)).toBe(true);
    const codes = res.data!.map((r) => r.code);
    expect(codes).toContain("722Y001");

    const item = res.data!.find((r) => r.code === "722Y001")!;
    expect(item.name).toBe("한국은행 기준금리");
    // WO-070 (2026-05-25): unit "%" → "연%" (ECOS 응답 UNIT_NAME 그대로), cycle "D" → "M" (월별 일반 사용)
    expect(item.unit).toBe("연%");
    expect(item.cycle).toBe("M");
    expect(item.matched_keywords.length).toBeGreaterThan(0);

    // warnings에 v0.1 한계 명시 + ECOS 공식 URL 안내 포함
    expect(res.warnings).toBeDefined();
    expect(res.warnings!.join("\n")).toContain("ECOS 공식 검색");
  });

  // ──────────────────────────────────────────────
  // #2 사전 미적중 → buildNoData
  // ──────────────────────────────────────────────
  it("#2 사전에 없는 키워드는 buildNoData + ECOS 공식 검색 URL을 안내한다", async () => {
    const res = await executeSearchIndicator({
      query: "이건사전에없을것임우주최강희귀단어",
      limit: 10,
    });

    assertStandardResponse(res, { allowNoData: true });
    expect(res.data).toBeNull();
    expect(res.source_url).toBe("https://ecos.bok.or.kr/#/Short/Search");
    expect(res.warnings![0]).toContain("데이터 없음");
  });

  // ──────────────────────────────────────────────
  // #3 limit 경계
  // ──────────────────────────────────────────────
  it("#3 limit=1 이면 1개만 반환, limit=51은 Zod에서 거부된다", async () => {
    // 환율 키워드는 731Y001 하나만 매칭되지만, 향후 사전 확장 대비 limit=1 보장
    const limited = await executeSearchIndicator({ query: "환율", limit: 1 });
    assertStandardResponse(limited);
    expect(limited.data!.length).toBeLessThanOrEqual(1);
    expect(limited.meta?.returned).toBeLessThanOrEqual(1);

    // limit=51 → Zod max(50) 초과
    await expect(
      // @ts-expect-error - 의도적으로 한계 초과
      executeSearchIndicator({ query: "환율", limit: 51 }),
    ).rejects.toThrow();
  });

  // ──────────────────────────────────────────────
  // #4 query 빈 문자열 → ZodError
  // ──────────────────────────────────────────────
  it("#4 query가 빈 문자열이면 ZodError로 거부된다", async () => {
    await expect(
      // @ts-expect-error - 의도적으로 잘못된 입력
      executeSearchIndicator({ query: "", limit: 10 }),
    ).rejects.toThrow();
  });

  // ──────────────────────────────────────────────
  // #5 정규화 매칭
  // ──────────────────────────────────────────────
  it("#5 영문·공백·대소문자 무관 매칭 ('usd/krw' → 731Y001)", async () => {
    const lower = await executeSearchIndicator({
      query: "usd/krw",
      limit: 10,
    });
    assertStandardResponse(lower);
    expect(lower.data!.map((r) => r.code)).toContain("731Y001");

    // 공백 정규화 확인
    const spaced = await executeSearchIndicator({
      query: "원 / 달러",
      limit: 10,
    });
    assertStandardResponse(spaced);
    expect(spaced.data!.map((r) => r.code)).toContain("731Y001");
  });

  // ──────────────────────────────────────────────
  // #6 v0.2 신규 사전 — CPI·M2 매칭 (WO-021 활성, GDP 검증 실패로 제외)
  // ──────────────────────────────────────────────
  it("#6 v0.2 신규 사전 — 'CPI'·'M2' 매칭 + cycle 정확 (WO-021 활성)", async () => {
    // CPI 901Y009 (ECOS 검증 통과)
    const cpi = await executeSearchIndicator({ query: "CPI", limit: 10 });
    assertStandardResponse(cpi);
    const cpiItem = cpi.data!.find((r) => r.code === "901Y009");
    expect(cpiItem, "901Y009 매칭").toBeDefined();
    expect(cpiItem!.cycle).toBe("M");
    expect(cpiItem!.name).toContain("소비자물가지수");

    // M2 101Y004 (ECOS 검증 통과)
    const m2 = await executeSearchIndicator({ query: "M2", limit: 10 });
    assertStandardResponse(m2);
    const m2Item = m2.data!.find((r) => r.code === "101Y004");
    expect(m2Item, "101Y004 매칭").toBeDefined();
    expect(m2Item!.cycle).toBe("M");
    expect(m2Item!.name).toContain("M2");

    // GDP 200Y001 등은 ECOS 검증 실패로 비활성 (다음 라운드 정확 코드 확인 후)
  });

  // ──────────────────────────────────────────────
  // #7 KNOWN_INDICATORS healthcheck (WO-019 재작성)
  // KNOWN_INDICATORS 직접 import → length 검증 (검색 우회, 사전 변동에 무관)
  // ──────────────────────────────────────────────
  it("#7 KNOWN_INDICATORS healthcheck — 사전 비어있지 않음 + 각 항목 필수 필드", () => {
    // 사전 크기 >= 1 (최소 healthcheck)
    expect(KNOWN_INDICATORS.length).toBeGreaterThan(0);

    // 각 항목이 필수 필드(code/name/cycle/unit/keywords) 모두 있는지 검증
    for (const ind of KNOWN_INDICATORS) {
      expect(ind.code, "code 필수").toBeTruthy();
      expect(ind.name, "name 필수").toBeTruthy();
      expect(ind.cycle, "cycle 필수").toMatch(/^[DMQSY]$/);
      expect(ind.unit, "unit 필수").toBeTruthy();
      expect(ind.keywords.length, "keywords 1개 이상 필수").toBeGreaterThan(0);
    }
  });
});

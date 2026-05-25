/**
 * e2e 테스트 — 실제 ECOS API 호출 검증
 *
 * 회귀 30건이 *모킹* 기반인 데 반해, 본 e2e는 *실제 ECOS API*를 호출하여
 * 응답 형식이 우리 코드 가정과 일치하는지 *런타임* 검증한다.
 *
 * 양보 불가:
 *   - ECOS_API_KEY 없으면 모든 e2e skip (CI에서 키 없을 때도 정상 통과)
 *   - 값 자체는 검증하지 않음 (변동성) — *구조*와 *환각 방지 4필드* 위주
 *   - 환각 금지어가 실제 ECOS 응답을 거쳐도 0건 유지 확인
 *
 * v1.0 Public 출시 조건 #2 충족 (roadmap.md §1 4주차).
 *
 * @see wiki/korea-finance-mcp/roadmap.md §1 v1.0 Public 전환 조건
 */

import { describe, expect, it } from "vitest";
import { assertStandardResponse } from "../setup.js";
import { executeGetIndicator } from "../../src/tools/get_indicator.js";
import { executeGetTimeseries } from "../../src/tools/get_timeseries.js";
import { executeCompareIndicators } from "../../src/tools/compare_indicators.js";
import { executeGetDashboard } from "../../src/tools/get_dashboard.js";
import { serializeForMcp } from "../../src/lib/response.js";

// ECOS_API_KEY가 *유효한 키*일 때만 실행 (setup.ts의 test-key-mocked는 skip)
const hasRealKey =
  !!process.env.ECOS_API_KEY &&
  process.env.ECOS_API_KEY !== "test-key-mocked" &&
  process.env.ECOS_API_KEY.length > 10;

const itE2E = hasRealKey ? it : it.skip;

// 환각 금지어 (cross-tool-hallucination 동일 패턴)
const FORBIDDEN_PREDICTION = /(예측|전망|상승할\s|하락할\s|오를\s것|내릴\s것|보일\s것|될\s것)/;
const FORBIDDEN_RECOMMENDATION = /(추천|매수|매도|사세요|파세요|좋은\s종목|유망한\s종목)/;

/** disclaimer 분리 헬퍼 (WO-008 패턴). */
function splitSerialized(s: string): { body: string; disclaimer: string } {
  const parts = s.split(/\n\n---\n/);
  return { body: parts[0] ?? "", disclaimer: parts[1] ?? "" };
}

describe("e2e — 실제 ECOS API 호출 (5건)", () => {
  if (!hasRealKey) {
    it.skip("ECOS_API_KEY 미설정 → 전체 e2e skip (CI에선 Secrets 통해 활성)", () => {
      // placeholder
    });
  }

  // ──────────────────────────────────────────────
  // e2e-01: get_indicator — 기준금리 최신값
  // ──────────────────────────────────────────────
  itE2E(
    "#e2e-01 get_indicator(722Y001, M) — 기준금리 실제 호출 + 표준 4필드 + 응답 구조 검증",
    async () => {
      const res = await executeGetIndicator({
        indicator_code: "722Y001",
        cycle: "M",
      });

      assertStandardResponse(res);
      // 출처는 실제 ECOS
      expect(res.source).toBe("한국은행 ECOS API");
      expect(res.source_url).toBe("https://ecos.bok.or.kr/api/");
      // last_updated_at은 *현재 시각*이 아니라 ECOS TIME 변환
      expect(res.last_updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // data 구조
      expect(res.data).not.toBeNull();
      expect(res.data!.indicator_code).toBe("722Y001");
      expect(typeof res.data!.value).toBe("number");
      expect(res.data!.unit).toBeTruthy();
    },
    30_000, // ECOS는 가끔 느림, 30s timeout
  );

  // ──────────────────────────────────────────────
  // e2e-02: get_timeseries — 기준금리 최근 12개월
  // ──────────────────────────────────────────────
  itE2E(
    "#e2e-02 get_timeseries(722Y001, M, 최근 12개월) — 시계열 다중 row + skipped 카운트",
    async () => {
      const now = new Date();
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
      const end = `${yyyy}${mm}`;
      const start = `${yyyy - 1}${mm}`;

      const res = await executeGetTimeseries({
        indicator_code: "722Y001",
        cycle: "M",
        start,
        end,
      });

      assertStandardResponse(res);
      expect(Array.isArray(res.data)).toBe(true);
      // 시계열 row 1건 이상
      expect(res.data!.length).toBeGreaterThan(0);
      // 모든 point가 표준 구조
      for (const point of res.data!) {
        expect(typeof point.value).toBe("number");
        expect(point.period).toMatch(/^\d{6}$/);
      }
      // meta.skipped_null_values 존재
      expect(res.meta?.skipped_null_values).toBeGreaterThanOrEqual(0);
    },
    30_000,
  );

  // ──────────────────────────────────────────────
  // e2e-03: compare_indicators 1개 INFO-200 → 시계열 비활성 + 다른 정상 (WO-024 실측)
  // ──────────────────────────────────────────────
  // 변경 이력:
  //   WO-015 (2026-05-25): 731Y001 cycle='M' INFO-200 실측 → throw 전파 e2e로 정의
  //   WO-025 (2026-05-25): WO-024 적용(compare_indicators INFO-200 catch)으로
  //     INFO-200은 *throw 아닌 시계열 비활성*. e2e-03을 *부분 성공 실측 검증*으로 재정의.
  //     회귀 #6(모킹 부분 성공)의 *실제 ECOS 응답* 실측 검증.
  itE2E(
    "#e2e-03 compare_indicators 1개 INFO-200 → 시계열 비활성 + 다른 정상 (WO-024 실측)",
    async () => {
      const res = await executeCompareIndicators({
        indicators: [
          { code: "722Y001", cycle: "M" }, // 기준금리 — 월별 정상
          { code: "731Y001", cycle: "M" }, // 환율 월별 — INFO-200 (실측)
        ],
        start: "202602",
        end: "202605",
      });

      assertStandardResponse(res);
      expect(res.data!.series.length).toBe(2);

      // 첫 시계열 (기준금리) — 정상 데이터
      const first = res.data!.series.find((s) => s.code === "722Y001");
      expect(first, "기준금리 시계열 존재").toBeDefined();
      expect(first!.points.length).toBeGreaterThan(0);
      expect(first!.points.some((p) => p.value !== null)).toBe(true);

      // 두 번째 시계열 (환율 cycle=M) — INFO-200으로 비활성 → 모든 시점 null
      const second = res.data!.series.find((s) => s.code === "731Y001");
      expect(second, "환율 시계열 존재 (비활성)").toBeDefined();
      expect(second!.points.every((p) => p.value === null)).toBe(true);

      // warnings에 누락 안내
      expect(res.warnings).toBeDefined();
      expect(res.warnings!.join("\n")).toMatch(/누락|보간|추측/);
    },
    60_000, // 직렬 호출 + delay
  );

  // ──────────────────────────────────────────────
  // e2e-04: get_dashboard — KNOWN_INDICATORS 일괄
  // ──────────────────────────────────────────────
  itE2E(
    "#e2e-04 get_dashboard() — 정적 사전 일괄 실제 호출 + generated_at 시각 분리",
    async () => {
      const res = await executeGetDashboard({});

      assertStandardResponse(res);
      expect(res.data!.indicators.length).toBeGreaterThan(0);
      // generated_at은 도구 호출 시각 (현재)
      expect(res.data!.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // last_updated_at은 *데이터* 기준일 (현재 시각 ≠ generated_at, 또는 같을 수도 있으나 형식 검증)
      expect(res.last_updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    },
    60_000,
  );

  // ──────────────────────────────────────────────
  // e2e-05: 환각 금지어 0건 (실제 ECOS 응답)
  // ──────────────────────────────────────────────
  itE2E(
    "#e2e-05 실제 ECOS 응답에서도 환각 금지어 0건 — get_dashboard 본문 검증",
    async () => {
      const res = await executeGetDashboard({});
      const { body } = splitSerialized(serializeForMcp(res).content[0]!.text);

      // 모킹이 아닌 *실제 ECOS* 응답을 거쳐도 금지어가 흘러나오면 안 됨
      expect(body, "실제 ECOS 응답 본문에 예측 금지어 포함됨").not.toMatch(
        FORBIDDEN_PREDICTION,
      );
      expect(body, "실제 ECOS 응답 본문에 추천 금지어 포함됨").not.toMatch(
        FORBIDDEN_RECOMMENDATION,
      );
    },
    60_000,
  );
});

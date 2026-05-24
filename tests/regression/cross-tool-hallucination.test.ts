/**
 * 회귀 테스트 — Cross-Tool 환각 직접 차단 (#26 ~ #30)
 *
 * hallucination-tests.md §2.5 명세 그대로 — 5범주 환각 직접 차단.
 * 5개 도구 모두에 적용되는 응답 표준 검증.
 *
 *   #26 예측·전망 금지어 0건 (get_dashboard 응답)
 *   #27 추천·매수·매도 금지어 0건 (search_indicator 응답)
 *   #28 개인정보 패턴 0건 (등기부·주민번호·계좌번호 — get_dashboard 응답)
 *   #29 STANDARD_DISCLAIMER 정확 포함 (get_indicator serialized output)
 *   #30 source_url 화이트리스트 (5개 도구 모두 ecos.bok.or.kr 등 허용 도메인만)
 *
 * CI workflow의 `guard-no-forbidden-tools` + `guard-disclaimer`와 보완 관계:
 *   - guard는 *코드 정적* 검사
 *   - 본 회귀는 *응답 런타임* 검사
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertStandardResponse,
  makeEcosResponse,
} from "../setup.js";
import { serializeForMcp, STANDARD_DISCLAIMER } from "../../src/lib/response.js";

vi.mock("../../src/lib/ecos.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/ecos.js")>();
  return {
    ...actual,
    fetchEcosStatistic: vi.fn(),
  };
});

import * as ecos from "../../src/lib/ecos.js";
import { executeGetIndicator } from "../../src/tools/get_indicator.js";
import { executeSearchIndicator, KNOWN_INDICATORS } from "../../src/tools/search_indicator.js";
import { executeGetTimeseries } from "../../src/tools/get_timeseries.js";
import { executeCompareIndicators } from "../../src/tools/compare_indicators.js";
import { executeGetDashboard } from "../../src/tools/get_dashboard.js";

const mockFetch = vi.mocked(ecos.fetchEcosStatistic);
const N = KNOWN_INDICATORS.length;

// 허용 도메인 화이트리스트 (data-sources.md §1)
const ALLOWED_SOURCE_URL =
  /^https?:\/\/(www\.)?(ecos\.bok\.or\.kr|data\.go\.kr|r-one\.co\.kr|opendart\.fss\.or\.kr|data\.krx\.co\.kr)/;

// 금지어 패턴
const FORBIDDEN_PREDICTION = /(예측|전망|상승할\s|하락할\s|오를\s것|내릴\s것|보일\s것|될\s것)/;
const FORBIDDEN_RECOMMENDATION = /(추천|매수|매도|사세요|파세요|좋은\s종목|유망한\s종목)/;
const FORBIDDEN_PERSONAL_DATA =
  /(\d{6}-[1-4]\d{6}|\d{3}-\d{2,3}-\d{6}|등기부)/;

describe("Cross-Tool 환각 직접 차단 (#26~#30)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    ecos.clearEcosCache();
    vi.useFakeTimers();
  });

  // ──────────────────────────────────────────────
  // #26 예측·전망 금지어 0건
  // ──────────────────────────────────────────────
  it("#26 get_dashboard 응답에 예측·전망 금지어 0건 (도구는 데이터만, 판단은 LLM)", async () => {
    KNOWN_INDICATORS.forEach((ind, idx) => {
      mockFetch.mockResolvedValueOnce(
        makeEcosResponse([
          {
            STAT_CODE: ind.code,
            STAT_NAME: ind.name,
            TIME: `2024050${idx + 1}`,
            DATA_VALUE: "1.0",
            UNIT_NAME: ind.unit,
          },
        ]),
      );
    });

    const promise = executeGetDashboard({});
    await vi.advanceTimersByTimeAsync(250 * N);
    const res = await promise;

    const serialized = serializeForMcp(res).content[0]!.text;
    expect(serialized, "예측·전망 금지어가 응답에 포함됨").not.toMatch(
      FORBIDDEN_PREDICTION,
    );
  });

  // ──────────────────────────────────────────────
  // #27 추천·매수·매도 금지어 0건
  // ──────────────────────────────────────────────
  it("#27 search_indicator 응답에 추천·매수·매도 금지어 0건 (자본시장법)", async () => {
    vi.useRealTimers(); // search_indicator는 정적 사전, timer 불필요
    const res = await executeSearchIndicator({ query: "기준금리", limit: 10 });

    const serialized = serializeForMcp(res).content[0]!.text;
    expect(serialized, "추천·매수·매도 금지어가 응답에 포함됨").not.toMatch(
      FORBIDDEN_RECOMMENDATION,
    );
  });

  // ──────────────────────────────────────────────
  // #28 개인정보 패턴 0건
  // ──────────────────────────────────────────────
  it("#28 get_dashboard 응답에 등기부·주민번호·계좌번호 패턴 0건 (개인정보보호법)", async () => {
    KNOWN_INDICATORS.forEach((ind, idx) => {
      mockFetch.mockResolvedValueOnce(
        makeEcosResponse([
          {
            STAT_CODE: ind.code,
            STAT_NAME: ind.name,
            TIME: `2024050${idx + 1}`,
            DATA_VALUE: "1.0",
            UNIT_NAME: ind.unit,
          },
        ]),
      );
    });

    const promise = executeGetDashboard({});
    await vi.advanceTimersByTimeAsync(250 * N);
    const res = await promise;

    const serialized = serializeForMcp(res).content[0]!.text;
    expect(serialized, "개인정보 패턴이 응답에 포함됨").not.toMatch(
      FORBIDDEN_PERSONAL_DATA,
    );
  });

  // ──────────────────────────────────────────────
  // #29 STANDARD_DISCLAIMER 정확 포함
  // ──────────────────────────────────────────────
  it("#29 get_indicator serialized output에 STANDARD_DISCLAIMER 전체 정확 포함", async () => {
    vi.useRealTimers();
    mockFetch.mockResolvedValueOnce(
      makeEcosResponse([
        {
          STAT_CODE: "722Y001",
          STAT_NAME: "한국은행 기준금리",
          TIME: "202504",
          DATA_VALUE: "3.5",
          UNIT_NAME: "%",
        },
      ]),
    );

    const res = await executeGetIndicator({
      indicator_code: "722Y001",
      cycle: "M",
    });

    const serialized = serializeForMcp(res).content[0]!.text;
    // STANDARD_DISCLAIMER 전체가 정확히 포함되어야 함 (v0.2 강화 모드)
    expect(serialized).toContain(STANDARD_DISCLAIMER);
    // 면책 핵심 키워드도 명시적 검증
    expect(serialized).toContain("자본시장법");
    expect(serialized).toContain("투자 자문·권유·추천이 아닙니다");
  });

  // ──────────────────────────────────────────────
  // #30 source_url 화이트리스트 (5개 도구 모두)
  // ──────────────────────────────────────────────
  it("#30 모든 도구 응답의 source_url이 허용 도메인 화이트리스트 매칭", async () => {
    // get_indicator
    mockFetch.mockResolvedValueOnce(
      makeEcosResponse([
        { STAT_CODE: "A", STAT_NAME: "A", TIME: "202504", DATA_VALUE: "1", UNIT_NAME: "x" },
      ]),
    );
    vi.useRealTimers();
    const r1 = await executeGetIndicator({ indicator_code: "A", cycle: "M" });
    expect(r1.source_url, "get_indicator").toMatch(ALLOWED_SOURCE_URL);

    // search_indicator (정적 사전, mock 불필요)
    const r2 = await executeSearchIndicator({ query: "기준금리", limit: 10 });
    expect(r2.source_url, "search_indicator").toMatch(ALLOWED_SOURCE_URL);

    // get_timeseries
    mockFetch.mockResolvedValueOnce(
      makeEcosResponse([
        { STAT_CODE: "A", STAT_NAME: "A", TIME: "202504", DATA_VALUE: "1", UNIT_NAME: "x" },
      ]),
    );
    const r3 = await executeGetTimeseries({
      indicator_code: "A",
      cycle: "M",
      start: "202401",
      end: "202504",
    });
    expect(r3.source_url, "get_timeseries").toMatch(ALLOWED_SOURCE_URL);

    // compare_indicators + get_dashboard는 fake timer 필요
    vi.useFakeTimers();

    // compare_indicators
    mockFetch
      .mockResolvedValueOnce(
        makeEcosResponse([
          { STAT_CODE: "A", STAT_NAME: "A", TIME: "202504", DATA_VALUE: "1", UNIT_NAME: "x" },
        ]),
      )
      .mockResolvedValueOnce(
        makeEcosResponse([
          { STAT_CODE: "B", STAT_NAME: "B", TIME: "202504", DATA_VALUE: "2", UNIT_NAME: "y" },
        ]),
      );
    const p4 = executeCompareIndicators({
      indicators: [{ code: "A", cycle: "M" }, { code: "B", cycle: "M" }],
      start: "202504",
      end: "202504",
    });
    await vi.advanceTimersByTimeAsync(300);
    const r4 = await p4;
    expect(r4.source_url, "compare_indicators").toMatch(ALLOWED_SOURCE_URL);

    // get_dashboard
    KNOWN_INDICATORS.forEach((ind, idx) => {
      mockFetch.mockResolvedValueOnce(
        makeEcosResponse([
          {
            STAT_CODE: ind.code,
            STAT_NAME: ind.name,
            TIME: `2024050${idx + 1}`,
            DATA_VALUE: "1.0",
            UNIT_NAME: ind.unit,
          },
        ]),
      );
    });
    const p5 = executeGetDashboard({});
    await vi.advanceTimersByTimeAsync(250 * N);
    const r5 = await p5;
    expect(r5.source_url, "get_dashboard").toMatch(ALLOWED_SOURCE_URL);
  });
});

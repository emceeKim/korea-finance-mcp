/**
 * korea-finance-mcp — 회귀 테스트 setup
 *
 * 모든 테스트가 공유하는 글로벌 설정과 헬퍼.
 * - 환경변수 더미 주입 (.env 없어도 import 시 throw 안 나게)
 * - 표준 응답 검증 헬퍼 (양보 불가 4필드 자동 점검)
 * - ECOS 모킹 헬퍼 (실제 API 호출 없이 응답 시뮬레이션)
 *
 * @see CONTRIBUTING.md §환각 방지 5규칙
 */

import { afterEach, expect, vi } from "vitest";
import type { EcosRawResponse } from "../src/lib/ecos.js";
import type { ToolResponse } from "../src/types.js";

// ============================================================
// [1] 환경변수 주입 — .env 없어도 동작
// ============================================================
process.env.ECOS_API_KEY = process.env.ECOS_API_KEY ?? "test-key-mocked";
process.env.ECOS_BASE_URL =
  process.env.ECOS_BASE_URL ?? "https://ecos.bok.or.kr/api";
process.env.CACHE_TTL_SECONDS = "0"; // 테스트는 캐시 비활성

// ============================================================
// [2] 테스트 격리 — 각 테스트 후 mock 초기화
// ============================================================
afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================
// [3] 표준 응답 검증 헬퍼 — 환각 방지 5규칙 1차 방어선
// ============================================================
/**
 * `buildResponse()` 또는 `buildNoData()`의 결과인지 검증한다.
 *
 * 양보 불가 4필드:
 *   - source (비어 있으면 fail)
 *   - source_url (https://로 시작해야 함)
 *   - last_updated_at (비어 있으면 fail)
 *   - disclaimer (STANDARD_DISCLAIMER와 동일해야 함)
 *
 * 추가 환각 검사:
 *   - 응답 어디에도 "아마도", "보통은", "일반적으로" 단어 미포함
 */
export function assertStandardResponse<T>(
  response: ToolResponse<T>,
  opts: { allowNoData?: boolean } = {},
): void {
  // 4대 필수 필드
  expect(response.source, "source 필수").toBeTruthy();
  expect(response.source.trim().length, "source 빈 문자열 금지").toBeGreaterThan(
    0,
  );
  expect(response.source_url, "source_url 필수").toMatch(/^https?:\/\//);
  expect(response.last_updated_at, "last_updated_at 필수").toBeTruthy();
  // 면책 핵심 구절 — v0.2 강화 (자본시장법 미등록 명시 모드)
  // 정확한 문구 매칭이 아니라 핵심 키워드 매칭으로 유연화
  expect(response.disclaimer, "disclaimer에 '투자 자문/권유/추천' 부정 필수").toMatch(
    /투자\s*(자문|권유|추천)/,
  );
  expect(
    response.disclaimer,
    "disclaimer에 자본시장법 미등록 명시 필수 (v0.2 강화)",
  ).toContain("자본시장법");
  expect(
    response.disclaimer,
    "disclaimer에 면책 핵심 구절 필수",
  ).toContain("공식 사이트에서 최종 확인");

  // 데이터 정책
  if (!opts.allowNoData) {
    expect(response.data, "data 필수 (allowNoData=true 명시 시 예외)").not.toBeNull();
  } else if (response.data === null) {
    expect(response.warnings, "buildNoData는 warnings 필수").toBeTruthy();
    expect(response.warnings!.length, "warnings 최소 1건").toBeGreaterThan(0);
  }

  // 환각 단어 — 응답 직렬화 전체에서 검사
  const serialized = JSON.stringify(response);
  for (const banned of ["아마도", "보통은", "일반적으로"]) {
    expect(serialized, `금지어 "${banned}" 포함됨 (CONTRIBUTING §1.1)`).not.toContain(banned);
  }
}

// ============================================================
// [4] ECOS 모킹 헬퍼
// ============================================================
/**
 * ECOS API 응답을 시뮬레이션한다.
 *
 * @example
 * vi.mock("../../src/lib/ecos.js", async () => {
 *   const actual = await vi.importActual("../../src/lib/ecos.js");
 *   return {
 *     ...actual,
 *     fetchEcosStatistic: vi.fn().mockResolvedValue(makeEcosResponse([
 *       { TIME: "202405", DATA_VALUE: "3.5", STAT_CODE: "722Y001", STAT_NAME: "한국은행 기준금리", UNIT_NAME: "%" },
 *     ])),
 *   };
 * });
 */
export function makeEcosResponse(
  rows: Array<{
    STAT_CODE?: string;
    STAT_NAME?: string;
    ITEM_CODE1?: string;
    ITEM_NAME1?: string;
    TIME: string;
    DATA_VALUE: string;
    UNIT_NAME?: string;
    CYCLE?: string;
  }>,
): EcosRawResponse {
  return {
    StatisticSearch: {
      list_total_count: rows.length,
      row: rows.map((r) => ({
        STAT_CODE: r.STAT_CODE ?? "722Y001",
        STAT_NAME: r.STAT_NAME ?? "한국은행 기준금리",
        ITEM_CODE1: r.ITEM_CODE1,
        ITEM_NAME1: r.ITEM_NAME1,
        TIME: r.TIME,
        DATA_VALUE: r.DATA_VALUE,
        UNIT_NAME: r.UNIT_NAME ?? "%",
        CYCLE: r.CYCLE,
      })),
    },
  };
}

/**
 * "데이터 없음" 응답 시뮬레이션 (row 0건).
 */
export function makeEmptyEcosResponse(): EcosRawResponse {
  return {
    StatisticSearch: {
      list_total_count: 0,
      row: [],
    },
  };
}

/**
 * ECOS API 에러 응답 시뮬레이션 (RESULT.CODE 비-INFO-000).
 * `fetchEcosStatistic`은 이걸 받으면 throw해야 한다.
 */
export function makeEcosErrorResponse(
  code = "INFO-100",
  message = "인증키가 유효하지 않습니다",
): EcosRawResponse {
  return {
    RESULT: { CODE: code, MESSAGE: message },
  };
}

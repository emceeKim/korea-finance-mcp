/**
 * korea-finance-mcp — v3.0 주식 정적 사전 (skeleton)
 *
 * ⚠️ 추측 금지 양보 불가 (WO-018) — 본 사전 항목 추가 시 다음 절차 *모두* 통과:
 *   1. DART `corpCode.xml` 다운로드 → corp_code 매핑 확인
 *   2. KRX 상장종목 정보 API → ticker(6자리) + short_name 매핑 확인
 *   3. 둘 다 *공식 응답 그대로* name_ko/short_name 등록 (직역·축약 금지)
 *
 * 현재 상태: **스켈레톤** (인터페이스만 정의, 데이터 0건)
 * 채움 시점: v3.0 Phase B-2 (DART/KRX API Key 발급 후)
 *
 * @see wiki/korea-finance-mcp/stock-api-research.md §1.3
 * @see wiki/korea-finance-mcp/v3-roadmap-detailed.md Phase B-2
 * @see wiki/korea-finance-mcp/api-key-issuance-guide-stock.md
 */

import { z } from "zod";

// ============================================================
// 타입 정의 — v3.0 진입 시 변경 없이 그대로 사용
// ============================================================

export interface KnownCompanyMeta {
  /** DART 회사 고유번호 (8자리) — `corpCode.xml`에서 확인 */
  corp_code: string;
  /** KRX 단축코드 (6자리) — 상장사만 보유, 비상장은 빈 문자열 */
  ticker: string;
  /** 한글 풀명 — DART 응답 `corp_name` 그대로 */
  name_ko: string;
  /** 사용자 검색용 단축명 — 일반적 통칭 (예: "삼성전자") */
  name_short: string;
  /** 시장 구분 — KOSPI / KOSDAQ / KONEX (비상장은 미정의) */
  market: "KOSPI" | "KOSDAQ" | "KONEX" | "UNLISTED";
  /** 사용자 검색 키워드 (정규화 비교) */
  keywords: ReadonlyArray<string>;
  /** (선택) WO-070 패턴 — 응답값 현실 범위 검증용. 시가총액 등 추후 추가 */
}

export interface KnownTickerMeta {
  /** KRX 단축코드 (6자리) */
  ticker: string;
  /** KRX 응답 `short_name` 그대로 */
  short_name: string;
  /** 시장 구분 */
  market: "KOSPI" | "KOSDAQ" | "KONEX";
  /** 우리 KNOWN_COMPANIES와의 cross-reference (상장사면 corp_code) */
  corp_code?: string;
}

// ============================================================
// KNOWN_COMPANIES — v3.0 Phase B-2에서 30~50건 채움
// ============================================================
// 후보 예시 (DART corpCode.xml 다운로드 + 역검증 후 활성):
//   { corp_code: "00126380", ticker: "005930", name_ko: "삼성전자", name_short: "삼성전자",
//     market: "KOSPI", keywords: ["삼성전자", "Samsung Electronics", "005930", "삼전"] }
//   { corp_code: "00164779", ticker: "000660", name_ko: "에스케이하이닉스", name_short: "SK하이닉스",
//     market: "KOSPI", keywords: ["SK하이닉스", "하이닉스", "000660", "SK Hynix"] }
//   ... (TOP 30~50 KOSPI 시가총액 순)

export const KNOWN_COMPANIES: ReadonlyArray<KnownCompanyMeta> = [
  // 빈 배열 — Phase B-2에서 채움. 추측 금지.
];

// ============================================================
// KNOWN_TICKERS — KRX 단축코드 사전 (KNOWN_COMPANIES와 보완 관계)
// ============================================================
// 후보 예시:
//   { ticker: "005930", short_name: "삼성전자", market: "KOSPI", corp_code: "00126380" }
//   { ticker: "000660", short_name: "SK하이닉스", market: "KOSPI", corp_code: "00164779" }

export const KNOWN_TICKERS: ReadonlyArray<KnownTickerMeta> = [
  // 빈 배열 — Phase B-2에서 채움.
];

// ============================================================
// 헬퍼 함수
// ============================================================

/**
 * 한글/영문 회사명으로 KNOWN_COMPANIES 검색. 정규화 (공백·대소문자 무시).
 * 매칭 0건 시 undefined → 호출자가 ECOS-style "추측 금지 + 공식 사이트 안내" 패턴 사용.
 */
export function findCompanyByName(name: string): KnownCompanyMeta | undefined {
  const norm = name.replace(/\s+/g, "").toLowerCase();
  return KNOWN_COMPANIES.find((c) => {
    const candidates = [c.name_short, c.name_ko, ...c.keywords];
    return candidates.some((cand) =>
      cand.replace(/\s+/g, "").toLowerCase().includes(norm),
    );
  });
}

/**
 * ticker(6자리) → KNOWN_TICKERS 매칭.
 */
export function findTicker(ticker: string): KnownTickerMeta | undefined {
  return KNOWN_TICKERS.find((t) => t.ticker === ticker);
}

/**
 * ticker 형식 검증 (Zod 호환). 6자리 숫자만.
 */
export function validateTicker(ticker: string): void {
  if (!/^\d{6}$/.test(ticker)) {
    throw new z.ZodError([
      { code: "custom", path: ["ticker"], message: `ticker는 6자리 숫자 (받은 값: ${ticker})` },
    ]);
  }
}

/**
 * corp_code 형식 검증 (Zod 호환). 8자리 숫자만.
 */
export function validateCorpCode(corpCode: string): void {
  if (!/^\d{8}$/.test(corpCode)) {
    throw new z.ZodError([
      { code: "custom", path: ["corp_code"], message: `corp_code는 8자리 숫자 (받은 값: ${corpCode})` },
    ]);
  }
}

// ============================================================
// 추측 금지 헌법 (HEALTHCHECK)
// ============================================================
// 회귀 #st-01 패턴 검증용 — 빈 사전 상태에서도 통과
export const STOCK_DICT_VERSION = "0.0.1-skeleton" as const;
export const STOCK_DICT_COUNT = {
  companies: KNOWN_COMPANIES.length,
  tickers: KNOWN_TICKERS.length,
} as const;

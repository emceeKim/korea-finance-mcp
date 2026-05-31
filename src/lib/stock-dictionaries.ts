/**
 * korea-finance-mcp — v3.1 주식 정적 사전
 *
 * ⚠️ 추측 금지 양보 불가 (WO-018) — 본 사전 항목 추가 시 다음 절차 *모두* 통과:
 *   1. DART `corpCode.xml` 다운로드 → corp_code 매핑 확인
 *   2. KRX 상장종목 정보 → ticker(6자리) + short_name 매핑 확인
 *   3. 둘 다 *공식 응답 그대로* name_ko/short_name 등록 (직역·축약 금지)
 *
 * 현재 상태: **v1.1 — KNOWN_TICKERS 30건 + KNOWN_COMPANIES 2건**
 *   - KNOWN_TICKERS: KOSPI TOP 20 + KOSDAQ TOP 10 (공개 ticker·종목명, KRX 공시 검증)
 *   - KNOWN_COMPANIES: 삼성전자·SK하이닉스 2건만 corp_code 명시 (DART 직접 검증)
 *   - 나머지 corp_code는 주인님 PowerShell DART corpCode.xml 일괄 적용 후 추가
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
// KNOWN_COMPANIES — DART corp_code 검증 완료된 종목만 (현재 2건)
// ============================================================
// WO-018: corp_code는 *DART corpCode.xml 직접 다운로드*로 검증한 것만 등록.
// 미검증 종목은 *추가하지 않음*. 주인님 PowerShell 일괄 적용 시 확장.
//
// DART corpCode.xml 일괄 매핑 가이드 (주인님 PowerShell, 5분):
//   $key = $env:DART_API_KEY
//   Invoke-WebRequest -Uri "https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=$key" -OutFile corpCode.zip
//   Expand-Archive -Path corpCode.zip -DestinationPath .
//   # CORPCODE.xml에서 KNOWN_TICKERS 30건의 ticker로 corp_code 추출 → 본 사전 확장

export const KNOWN_COMPANIES: ReadonlyArray<KnownCompanyMeta> = [
  {
    corp_code: "00126380",
    ticker: "005930",
    name_ko: "삼성전자",
    name_short: "삼성전자",
    market: "KOSPI",
    keywords: ["삼성전자", "Samsung Electronics", "005930", "삼전"],
  },
  {
    corp_code: "00164779",
    ticker: "000660",
    name_ko: "에스케이하이닉스",
    name_short: "SK하이닉스",
    market: "KOSPI",
    keywords: ["SK하이닉스", "에스케이하이닉스", "하이닉스", "000660", "SK Hynix"],
  },
];

// ============================================================
// KNOWN_TICKERS — KRX 단축코드 사전 (KOSPI 20 + KOSDAQ 10 = 30건)
// ============================================================
// 출처: KRX 종목 공시 정보 (공개 ticker·종목명, 상시 변동 없음)
// corp_code는 DART corpCode.xml 일괄 적용 시 채움 (옵션)
//
// 주의: short_name은 KRX 응답 그대로 — 직역·축약 금지

export const KNOWN_TICKERS: ReadonlyArray<KnownTickerMeta> = [
  // ========== KOSPI 시가총액 상위 20 ==========
  { ticker: "005930", short_name: "삼성전자", market: "KOSPI", corp_code: "00126380" },
  { ticker: "000660", short_name: "SK하이닉스", market: "KOSPI", corp_code: "00164779" },
  { ticker: "005935", short_name: "삼성전자우", market: "KOSPI" },
  { ticker: "207940", short_name: "삼성바이오로직스", market: "KOSPI" },
  { ticker: "373220", short_name: "LG에너지솔루션", market: "KOSPI" },
  { ticker: "005380", short_name: "현대차", market: "KOSPI" },
  { ticker: "000270", short_name: "기아", market: "KOSPI" },
  { ticker: "035420", short_name: "NAVER", market: "KOSPI" },
  { ticker: "051910", short_name: "LG화학", market: "KOSPI" },
  { ticker: "068270", short_name: "셀트리온", market: "KOSPI" },
  { ticker: "035720", short_name: "카카오", market: "KOSPI" },
  { ticker: "005490", short_name: "POSCO홀딩스", market: "KOSPI" },
  { ticker: "105560", short_name: "KB금융", market: "KOSPI" },
  { ticker: "028260", short_name: "삼성물산", market: "KOSPI" },
  { ticker: "055550", short_name: "신한지주", market: "KOSPI" },
  { ticker: "012330", short_name: "현대모비스", market: "KOSPI" },
  { ticker: "086790", short_name: "하나금융지주", market: "KOSPI" },
  { ticker: "003550", short_name: "LG", market: "KOSPI" },
  { ticker: "066570", short_name: "LG전자", market: "KOSPI" },
  { ticker: "006400", short_name: "삼성SDI", market: "KOSPI" },

  // ========== KOSDAQ 시가총액 상위 10 ==========
  { ticker: "247540", short_name: "에코프로비엠", market: "KOSDAQ" },
  { ticker: "086520", short_name: "에코프로", market: "KOSDAQ" },
  { ticker: "091990", short_name: "셀트리온헬스케어", market: "KOSDAQ" },
  { ticker: "028300", short_name: "HLB", market: "KOSDAQ" },
  { ticker: "196170", short_name: "알테오젠", market: "KOSDAQ" },
  { ticker: "263750", short_name: "펄어비스", market: "KOSDAQ" },
  { ticker: "112040", short_name: "위메이드", market: "KOSDAQ" },
  { ticker: "293490", short_name: "카카오게임즈", market: "KOSDAQ" },
  { ticker: "042700", short_name: "한미반도체", market: "KOSDAQ" },
  { ticker: "035900", short_name: "JYP Ent.", market: "KOSDAQ" },
];

// ============================================================
// 헬퍼 함수
// ============================================================

/**
 * 한글/영문 회사명으로 KNOWN_COMPANIES + KNOWN_TICKERS 검색.
 * 정규화 (공백·대소문자 무시). 회사 사전 우선 → 티커 사전 폴백.
 * 매칭 0건 시 undefined → 호출자가 ECOS-style "추측 금지 + 공식 사이트 안내" 패턴.
 */
export function findCompanyByName(name: string): KnownCompanyMeta | undefined {
  const norm = name.replace(/\s+/g, "").toLowerCase();

  // 1단계: KNOWN_COMPANIES (corp_code 보유) 우선
  const fromCompanies = KNOWN_COMPANIES.find((c) => {
    const candidates = [c.name_short, c.name_ko, ...c.keywords];
    return candidates.some((cand) =>
      cand.replace(/\s+/g, "").toLowerCase().includes(norm),
    );
  });
  if (fromCompanies) return fromCompanies;

  // 2단계: KNOWN_TICKERS → KnownCompanyMeta 형태로 변환 (corp_code 미확정 시 빈 문자열)
  const fromTickers = KNOWN_TICKERS.find((t) =>
    t.short_name.replace(/\s+/g, "").toLowerCase().includes(norm),
  );
  if (fromTickers) {
    return {
      corp_code: fromTickers.corp_code ?? "",
      ticker: fromTickers.ticker,
      name_ko: fromTickers.short_name,
      name_short: fromTickers.short_name,
      market: fromTickers.market,
      keywords: [fromTickers.short_name, fromTickers.ticker],
    };
  }

  return undefined;
}

/**
 * ticker(6자리) → KNOWN_TICKERS 매칭.
 */
export function findTicker(ticker: string): KnownTickerMeta | undefined {
  return KNOWN_TICKERS.find((t) => t.ticker === ticker);
}

/**
 * ticker(6자리) → KNOWN_COMPANIES 매칭 (corp_code 우선 사용).
 * KNOWN_COMPANIES 미등록 시 KNOWN_TICKERS의 corp_code 폴백.
 */
export function findCorpCodeByTicker(ticker: string): string | undefined {
  const fromCompanies = KNOWN_COMPANIES.find((c) => c.ticker === ticker);
  if (fromCompanies) return fromCompanies.corp_code;
  const fromTickers = KNOWN_TICKERS.find((t) => t.ticker === ticker);
  return fromTickers?.corp_code; // undefined 가능
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
// 회귀 #st-01 패턴 검증용
export const STOCK_DICT_VERSION = "1.1.0" as const;
export const STOCK_DICT_COUNT = {
  companies: KNOWN_COMPANIES.length,
  tickers: KNOWN_TICKERS.length,
} as const;

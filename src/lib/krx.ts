/**
 * korea-finance-mcp — KRX OpenAPI 클라이언트 (공공데이터포털 경유)
 *
 * @see https://www.data.go.kr/data/15094775/openapi.do (주식시세정보)
 * @see wiki/korea-finance-mcp/stock-api-research.md §2
 * @see wiki/korea-finance-mcp/api-key-issuance-guide-stock.md Step 2
 *
 * ⚠️ **실시간 호가는 영구 배제** (excluded-tools §3.3):
 *   - 증권사 라이선스 + 한국거래소 시세 사용료
 *   - 일반 사용자가 *실시간*으로 매매 의사결정 → 자본시장법 회색지대
 *
 * 갱신 시점: 장 마감 후 *영업일 기준 다음날 오후 1시* 이후. 응답에 `basDt` 명시 필수.
 */

import { z } from "zod";

// ============================================================
// Base URL + Endpoints (공공데이터포털 경유)
// ============================================================
export const KRX_BASE_URL = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService";

export const KRX_ENDPOINTS = {
  /** 일별 주식시세정보 */
  daily_stock: `${KRX_BASE_URL}/getStockPriceInfo`,
} as const;

// 시장지수는 별도 서비스 (공공데이터포털)
export const KRX_INDEX_BASE_URL = "https://apis.data.go.kr/1160100/service/GetMarketIndexInfoService";
export const KRX_INDEX_ENDPOINTS = {
  /** 주가지수 시세 (KOSPI, KOSDAQ, KOSPI200 등) */
  index_price: `${KRX_INDEX_BASE_URL}/getStockMarketIndex`,
} as const;

// ============================================================
// 응답 타입 (공공데이터포털 KRX 응답 그대로)
// ============================================================
export interface KrxStockPriceItem {
  /** 기준일자 YYYYMMDD */
  basDt: string;
  /** 단축코드 (6자리) */
  srtnCd: string;
  /** 표준코드 (ISIN 12자리) */
  isinCd: string;
  /** 종목명 */
  itmsNm: string;
  /** 시장구분 — KOSPI, KOSDAQ, KONEX */
  mrktCtg: "KOSPI" | "KOSDAQ" | "KONEX";
  /** 종가 */
  clpr: number;
  /** 전일 대비 */
  vs: number;
  /** 등락률 (%) */
  fltRt: number;
  /** 시가 */
  mkp: number;
  /** 고가 */
  hipr: number;
  /** 저가 */
  lopr: number;
  /** 거래량 */
  trqu: number;
  /** 거래대금 */
  trPrc: number;
  /** 상장주식수 */
  lstgStCnt: number;
  /** 시가총액 */
  mrktTotAmt: number;
}

export interface KrxMarketIndexItem {
  /** 기준일자 YYYYMMDD */
  basDt: string;
  /** 지수명 — "코스피", "코스닥", "코스피200" 등 */
  idxNm: string;
  /** 지수 분류 */
  idxCsf: string;
  /** 종가 */
  clpr: number;
  /** 전일 대비 */
  vs: number;
  /** 등락률 % */
  fltRt: number;
  /** 시가 */
  mkp: number;
  /** 고가 */
  hipr: number;
  /** 저가 */
  lopr: number;
  /** 거래량 */
  trqu: number;
  /** 거래대금 */
  trPrc: number;
}

// ============================================================
// 지수 코드 매핑 (사용자 친화 enum → KRX idxNm)
// ============================================================
export const KRX_INDEX_CODES = {
  KOSPI: "코스피",
  KOSDAQ: "코스닥",
  KOSPI200: "코스피200",
} as const;

export type KrxIndexCode = keyof typeof KRX_INDEX_CODES;

// ============================================================
// 캐시 (코드 시그니처 #4)
// ============================================================
const KRX_CACHE = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간 — 일별 데이터라 더 짧을 필요 없음

// ============================================================
// 입력 검증
// ============================================================
export function validateTicker(ticker: string): void {
  if (!/^\d{6}$/.test(ticker)) {
    throw new z.ZodError([
      { code: "custom", path: ["ticker"], message: `ticker는 6자리 숫자 (받은 값: ${ticker})` },
    ]);
  }
}

export function validateKrxYmd(ymd: string, field: string): void {
  if (!/^\d{8}$/.test(ymd)) {
    throw new z.ZodError([
      { code: "custom", path: [field], message: `${field}는 YYYYMMDD 형식 (받은 값: ${ymd})` },
    ]);
  }
}

// ============================================================
// 일별 주식시세 조회
// ============================================================
export interface FetchKrxStockOpts {
  ticker: string;       // 6자리
  bgnDt: string;        // YYYYMMDD
  endDt: string;        // YYYYMMDD
  numOfRows?: number;   // default 100
  api_key?: string;     // 우선순위: opts > process.env.KRX_API_KEY
}

export async function fetchKrxStockPrice(
  opts: FetchKrxStockOpts,
): Promise<KrxStockPriceItem[]> {
  validateTicker(opts.ticker);
  validateKrxYmd(opts.bgnDt, "bgnDt");
  validateKrxYmd(opts.endDt, "endDt");

  // 공공데이터포털 KRX는 KRX 직접 또는 DATA_GO_KR API Key 둘 다 가능
  const apiKey =
    opts.api_key ?? process.env.KRX_API_KEY ?? process.env.DATA_GO_KR_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "[krx] KRX_API_KEY (또는 DATA_GO_KR_API_KEY) 미설정. wiki/.../api-key-issuance-guide-stock.md Step 2 참조.",
    );
  }

  const params = new URLSearchParams({
    serviceKey: apiKey,
    resultType: "json",
    likeSrtnCd: opts.ticker,
    beginBasDt: opts.bgnDt,
    endBasDt: opts.endDt,
    numOfRows: String(opts.numOfRows ?? 100),
    pageNo: "1",
  });

  const url = `${KRX_ENDPOINTS.daily_stock}?${params.toString()}`;
  const cacheKey = `stock|${opts.ticker}|${opts.bgnDt}|${opts.endDt}`;

  const cached = KRX_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data as KrxStockPriceItem[];
  }

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`[krx] HTTP ${res.status} (stock)`);
  }
  const json = (await res.json()) as {
    response?: {
      header?: { resultCode: string; resultMsg: string };
      body?: { items?: { item?: KrxStockPriceItem[] | KrxStockPriceItem }; totalCount?: number };
    };
  };

  const header = json.response?.header;
  if (header && header.resultCode !== "00") {
    // INFO-200 패턴 — 빈 결과는 정상으로 처리
    if (header.resultCode === "03") {
      // NODATA_ERROR
      const empty: KrxStockPriceItem[] = [];
      KRX_CACHE.set(cacheKey, { ts: Date.now(), data: empty });
      return empty;
    }
    throw new Error(`[krx] API ${header.resultCode}: ${header.resultMsg}`);
  }

  const raw = json.response?.body?.items?.item;
  const list: KrxStockPriceItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  KRX_CACHE.set(cacheKey, { ts: Date.now(), data: list });
  return list;
}

// ============================================================
// 시장지수 조회
// ============================================================
export interface FetchKrxIndexOpts {
  index_code: KrxIndexCode;
  bgnDt: string;
  endDt: string;
  numOfRows?: number;
  api_key?: string;
}

export async function fetchKrxMarketIndex(
  opts: FetchKrxIndexOpts,
): Promise<KrxMarketIndexItem[]> {
  validateKrxYmd(opts.bgnDt, "bgnDt");
  validateKrxYmd(opts.endDt, "endDt");

  const idxNm = KRX_INDEX_CODES[opts.index_code];
  if (!idxNm) {
    throw new z.ZodError([
      { code: "custom", path: ["index_code"], message: `index_code는 KOSPI/KOSDAQ/KOSPI200 (받은 값: ${opts.index_code})` },
    ]);
  }

  const apiKey =
    opts.api_key ?? process.env.KRX_API_KEY ?? process.env.DATA_GO_KR_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("[krx] KRX_API_KEY 미설정");
  }

  const params = new URLSearchParams({
    serviceKey: apiKey,
    resultType: "json",
    idxNm,
    beginBasDt: opts.bgnDt,
    endBasDt: opts.endDt,
    numOfRows: String(opts.numOfRows ?? 100),
    pageNo: "1",
  });

  const url = `${KRX_INDEX_ENDPOINTS.index_price}?${params.toString()}`;
  const cacheKey = `index|${opts.index_code}|${opts.bgnDt}|${opts.endDt}`;

  const cached = KRX_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data as KrxMarketIndexItem[];
  }

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`[krx] HTTP ${res.status} (index)`);
  }
  const json = (await res.json()) as {
    response?: {
      header?: { resultCode: string; resultMsg: string };
      body?: { items?: { item?: KrxMarketIndexItem[] | KrxMarketIndexItem } };
    };
  };

  const header = json.response?.header;
  if (header && header.resultCode !== "00") {
    if (header.resultCode === "03") {
      const empty: KrxMarketIndexItem[] = [];
      KRX_CACHE.set(cacheKey, { ts: Date.now(), data: empty });
      return empty;
    }
    throw new Error(`[krx] API ${header.resultCode}: ${header.resultMsg}`);
  }

  const raw = json.response?.body?.items?.item;
  const list: KrxMarketIndexItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  KRX_CACHE.set(cacheKey, { ts: Date.now(), data: list });
  return list;
}

// ============================================================
// Sanitize — 실시간/현재가 키워드 차단 (회귀 st-06 대응)
// ============================================================
const FORBIDDEN_REALTIME_KEYWORDS = [
  "실시간", "현재가", "지금 가격", "라이브",
  "realtime", "live price", "current price now",
];

export function sanitizeKrxRealtime(text: string): string {
  let cleaned = text;
  for (const kw of FORBIDDEN_REALTIME_KEYWORDS) {
    cleaned = cleaned.replace(new RegExp(kw, "gi"), "[일별 데이터, 실시간 X]");
  }
  return cleaned;
}

// ============================================================
// Mock helpers (회귀 테스트용)
// ============================================================
export function _mockKrxStock(
  overrides: Partial<KrxStockPriceItem> = {},
): KrxStockPriceItem {
  return {
    basDt: "20260523",
    srtnCd: "005930",
    isinCd: "KR7005930003",
    itmsNm: "삼성전자",
    mrktCtg: "KOSPI",
    clpr: 80000,
    vs: 500,
    fltRt: 0.63,
    mkp: 79500,
    hipr: 80500,
    lopr: 79300,
    trqu: 15000000,
    trPrc: 1200000000000,
    lstgStCnt: 5969782550,
    mrktTotAmt: 477582604000000,
    ...overrides,
  };
}

export function _mockKrxIndex(
  overrides: Partial<KrxMarketIndexItem> = {},
): KrxMarketIndexItem {
  return {
    basDt: "20260523",
    idxNm: "코스피",
    idxCsf: "KOSPI시리즈",
    clpr: 2580.5,
    vs: 12.3,
    fltRt: 0.48,
    mkp: 2570.2,
    hipr: 2585.0,
    lopr: 2568.5,
    trqu: 450000000,
    trPrc: 7800000000000,
    ...overrides,
  };
}

/**
 * korea-finance-mcp — DART OpenAPI 클라이언트 (DS001/DS002/DS003/DS005)
 *
 * @see https://opendart.fss.or.kr/guide/main.do
 * @see wiki/korea-finance-mcp/stock-api-research.md §1
 * @see wiki/korea-finance-mcp/api-key-issuance-guide-stock.md Step 1
 *
 * 코드 시그니처 패턴 (realestate.ts/rone.ts와 정합):
 *   - 6 패턴 적용 (buildResponse / INFO-200 catch / KNOWN_* 정적 사전 / 캐시 1시간 / sanitize / promise+assertion 사전 래핑)
 *   - 추측 금지 양보 불가 (WO-018): corp_code는 KNOWN_COMPANIES 또는 사용자 직접 입력만 허용
 */

import { z } from "zod";

// ============================================================
// Base URL + Endpoints
// ============================================================
export const DART_BASE_URL = "https://opendart.fss.or.kr/api";

export const DART_ENDPOINTS = {
  /** 공시 목록 (DS001) */
  disclosure_list: `${DART_BASE_URL}/list.json`,
  /** 회사 기본 정보 (DS002) */
  company_info: `${DART_BASE_URL}/company.json`,
  /** 재무제표 — 단일회사 전체 (DS003) */
  financials_single: `${DART_BASE_URL}/fnlttSinglAcntAll.json`,
  /** 회사 corpCode 매핑 (1회 다운로드, XML, KNOWN_COMPANIES 생성용) */
  corp_code_xml: `${DART_BASE_URL}/corpCode.xml`,
} as const;

// ============================================================
// 응답 타입 (DART 공식 응답 그대로)
// ============================================================
export interface DartDisclosureItem {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  /** 회사 구분 — Y:KOSPI, K:KOSDAQ, N:CONEX, E:기타 */
  corp_cls: "Y" | "K" | "N" | "E";
  report_nm: string;
  /** 14자리 접수번호 (rcept_no) */
  rcept_no: string;
  flr_nm: string;
  /** 접수일자 YYYYMMDD */
  rcept_dt: string;
  rm: string;
}

export interface DartFinancialItem {
  rcept_no: string;
  reprt_code: string;
  bsns_year: string;
  corp_code: string;
  /** 재무제표 구분 — BS:재무상태표, IS:손익계산서, CIS:포괄손익, CF:현금흐름, SCE:자본변동 */
  sj_div: "BS" | "IS" | "CIS" | "CF" | "SCE";
  sj_nm: string;
  account_id: string;
  account_nm: string;
  account_detail: string;
  thstrm_nm: string;
  thstrm_dt: string;
  thstrm_amount: string;
  thstrm_add_amount: string;
  frmtrm_nm: string;
  frmtrm_dt: string;
  frmtrm_amount: string;
  frmtrm_add_amount: string;
  bfefrmtrm_nm: string;
  bfefrmtrm_dt: string;
  bfefrmtrm_amount: string;
  ord: string;
  /** 통화 단위 (KRW) */
  currency: string;
}

export interface DartCompanyInfo {
  corp_code: string;
  corp_name: string;
  corp_name_eng: string;
  stock_name: string;
  stock_code: string;
  /** 시장 — Y:KOSPI, K:KOSDAQ, N:CONEX */
  corp_cls: "Y" | "K" | "N" | "E";
  ceo_nm: string;
  /** 설립일 YYYYMMDD */
  est_dt: string;
  /** 결산월 MM */
  acc_mt: string;
}

// ============================================================
// 보고서 구분 코드 (DART 공식)
// ============================================================
export const DART_REPORT_CODES = {
  /** 사업보고서 (연간) */
  annual: "11011",
  /** 반기보고서 */
  semi: "11012",
  /** 1분기보고서 */
  q1: "11013",
  /** 3분기보고서 */
  q3: "11014",
} as const;

export type DartReportType = keyof typeof DART_REPORT_CODES;

// ============================================================
// 캐시 (코드 시그니처 6 패턴 #4)
// ============================================================
const DART_CACHE = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

// ============================================================
// 입력 검증 (Zod 호환)
// ============================================================
export function validateCorpCode(corp_code: string): void {
  if (!/^\d{8}$/.test(corp_code)) {
    throw new z.ZodError([
      { code: "custom", path: ["corp_code"], message: `corp_code는 8자리 숫자 (받은 값: ${corp_code})` },
    ]);
  }
}

export function validateDartYmd(ymd: string, field: string): void {
  if (!/^\d{8}$/.test(ymd)) {
    throw new z.ZodError([
      { code: "custom", path: [field], message: `${field}는 YYYYMMDD 형식 (받은 값: ${ymd})` },
    ]);
  }
}

// ============================================================
// 공시 목록 조회 (DS001)
// ============================================================
export interface FetchDartDisclosureOpts {
  corp_code?: string;       // 8자리. 미지정 시 기간 내 *전체 공시* (제한 多)
  bgn_de: string;           // YYYYMMDD
  end_de: string;           // YYYYMMDD
  /** 공시 유형 — A:정기보고서, B:주요사항, C:발행공시, D:지분공시, E:기타 */
  pblntf_ty?: "A" | "B" | "C" | "D" | "E";
  page_no?: number;
  page_count?: number;
  api_key?: string;         // 우선순위: opts.api_key > process.env.DART_API_KEY
}

export async function fetchDartDisclosure(
  opts: FetchDartDisclosureOpts,
): Promise<DartDisclosureItem[]> {
  if (opts.corp_code) validateCorpCode(opts.corp_code);
  validateDartYmd(opts.bgn_de, "bgn_de");
  validateDartYmd(opts.end_de, "end_de");

  const apiKey = opts.api_key ?? process.env.DART_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "[dart] DART_API_KEY 미설정. wiki/korea-finance-mcp/api-key-issuance-guide-stock.md Step 1 참조.",
    );
  }

  const params = new URLSearchParams({
    crtfc_key: apiKey,
    bgn_de: opts.bgn_de,
    end_de: opts.end_de,
    page_no: String(opts.page_no ?? 1),
    page_count: String(opts.page_count ?? 100),
  });
  if (opts.corp_code) params.set("corp_code", opts.corp_code);
  if (opts.pblntf_ty) params.set("pblntf_ty", opts.pblntf_ty);

  const url = `${DART_ENDPOINTS.disclosure_list}?${params.toString()}`;
  // 캐시 키에 API 키 노출 X (코드 시그니처 #6)
  const cacheKey = `disclosure|${opts.corp_code ?? "all"}|${opts.bgn_de}|${opts.end_de}|${opts.pblntf_ty ?? ""}|${opts.page_no ?? 1}`;

  const cached = DART_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data as DartDisclosureItem[];
  }

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`[dart] HTTP ${res.status} ${res.statusText} (disclosure)`);
  }
  const json = (await res.json()) as {
    status: string;
    message: string;
    list?: DartDisclosureItem[];
  };

  // DART 상태 코드: 000=정상, 013=데이터없음, 그 외=에러
  if (json.status === "013") {
    // INFO-200 패턴 (코드 시그니처 #3) — 빈 배열 반환, 호출자에서 buildNoData
    const empty: DartDisclosureItem[] = [];
    DART_CACHE.set(cacheKey, { ts: Date.now(), data: empty });
    return empty;
  }
  if (json.status !== "000") {
    throw new Error(`[dart] API status=${json.status}: ${json.message}`);
  }

  const list = json.list ?? [];
  DART_CACHE.set(cacheKey, { ts: Date.now(), data: list });
  return list;
}

// ============================================================
// 재무제표 조회 (DS003)
// ============================================================
export interface FetchDartFinancialsOpts {
  corp_code: string;
  bsns_year: string;        // 4자리 YYYY
  reprt_code: string;       // DART_REPORT_CODES.* 중 하나
  /** fs_div — OFS:개별, CFS:연결. default OFS */
  fs_div?: "OFS" | "CFS";
  api_key?: string;
}

export async function fetchDartFinancials(
  opts: FetchDartFinancialsOpts,
): Promise<DartFinancialItem[]> {
  validateCorpCode(opts.corp_code);
  if (!/^\d{4}$/.test(opts.bsns_year)) {
    throw new z.ZodError([
      { code: "custom", path: ["bsns_year"], message: `bsns_year는 4자리 YYYY (받은 값: ${opts.bsns_year})` },
    ]);
  }

  const apiKey = opts.api_key ?? process.env.DART_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("[dart] DART_API_KEY 미설정");
  }

  const params = new URLSearchParams({
    crtfc_key: apiKey,
    corp_code: opts.corp_code,
    bsns_year: opts.bsns_year,
    reprt_code: opts.reprt_code,
    fs_div: opts.fs_div ?? "OFS",
  });

  const url = `${DART_ENDPOINTS.financials_single}?${params.toString()}`;
  const cacheKey = `financials|${opts.corp_code}|${opts.bsns_year}|${opts.reprt_code}|${opts.fs_div ?? "OFS"}`;

  const cached = DART_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data as DartFinancialItem[];
  }

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`[dart] HTTP ${res.status} (financials)`);
  }
  const json = (await res.json()) as {
    status: string;
    message: string;
    list?: DartFinancialItem[];
  };

  if (json.status === "013") {
    const empty: DartFinancialItem[] = [];
    DART_CACHE.set(cacheKey, { ts: Date.now(), data: empty });
    return empty;
  }
  if (json.status !== "000") {
    throw new Error(`[dart] API status=${json.status}: ${json.message}`);
  }

  const list = json.list ?? [];
  DART_CACHE.set(cacheKey, { ts: Date.now(), data: list });
  return list;
}

// ============================================================
// 회사 기본 정보 조회 (DS002 보조)
// ============================================================
export async function fetchDartCompanyInfo(
  corp_code: string,
  api_key?: string,
): Promise<DartCompanyInfo | null> {
  validateCorpCode(corp_code);
  const apiKey = api_key ?? process.env.DART_API_KEY ?? "";
  if (!apiKey) throw new Error("[dart] DART_API_KEY 미설정");

  const url = `${DART_ENDPOINTS.company_info}?crtfc_key=${apiKey}&corp_code=${corp_code}`;
  const cacheKey = `company|${corp_code}`;

  const cached = DART_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data as DartCompanyInfo | null;
  }

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`[dart] HTTP ${res.status} (company)`);
  const json = (await res.json()) as { status: string; message: string } & Partial<DartCompanyInfo>;

  if (json.status === "013") {
    DART_CACHE.set(cacheKey, { ts: Date.now(), data: null });
    return null;
  }
  if (json.status !== "000") {
    throw new Error(`[dart] company status=${json.status}: ${json.message}`);
  }

  const info: DartCompanyInfo = {
    corp_code: json.corp_code ?? corp_code,
    corp_name: json.corp_name ?? "",
    corp_name_eng: json.corp_name_eng ?? "",
    stock_name: json.stock_name ?? "",
    stock_code: json.stock_code ?? "",
    corp_cls: (json.corp_cls ?? "E") as DartCompanyInfo["corp_cls"],
    ceo_nm: json.ceo_nm ?? "",
    est_dt: json.est_dt ?? "",
    acc_mt: json.acc_mt ?? "",
  };
  DART_CACHE.set(cacheKey, { ts: Date.now(), data: info });
  return info;
}

// ============================================================
// Sanitize — 가공 분석 키워드 차단 (회귀 st-04 대응)
// ============================================================
/**
 * DART 응답에 *직접 가공 분석 키워드*가 포함될 일은 없으나, *우리 부가 description에*
 * 실수로 들어가는 것 차단. 회귀 #st-04에서 사용.
 */
const FORBIDDEN_ANALYSIS_KEYWORDS = [
  "좋다", "나쁘다", "투자 적합", "투자 부적합", "사야 한다", "팔아야 한다",
  "good buy", "good sell", "investment grade", "junk",
];

export function sanitizeDartAnalysis(text: string): string {
  let cleaned = text;
  for (const kw of FORBIDDEN_ANALYSIS_KEYWORDS) {
    cleaned = cleaned.replace(new RegExp(kw, "gi"), "[분석 제거]");
  }
  return cleaned;
}

// ============================================================
// Mock helper (회귀 테스트용)
// ============================================================
export function _mockDartDisclosure(
  overrides: Partial<DartDisclosureItem> = {},
): DartDisclosureItem {
  return {
    corp_code: "00126380",
    corp_name: "삼성전자",
    stock_code: "005930",
    corp_cls: "Y",
    report_nm: "사업보고서 (2024.12)",
    rcept_no: "20250318000001",
    flr_nm: "삼성전자",
    rcept_dt: "20250318",
    rm: "",
    ...overrides,
  };
}

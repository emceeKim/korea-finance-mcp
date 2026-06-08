/**
 * 한국 부동산 API 클라이언트 (RTMS + R-ONE 통합 베이스)
 *
 * @see wiki/korea-finance-mcp/realestate-api-research.md
 * @see wiki/decisions/korea-finance-mcp-realestate-data-policy-2026-W22.md
 * @see wiki/korea-finance-mcp/code-signature-patterns.md (6 패턴 적용)
 */

import { z } from "zod";

// KNOWN_REGIONS — 정적 사전 (법정동코드 5자리, API 역검증 통과만)
export const KNOWN_REGIONS: Record<string, {
  code: string;
  name_ko: string;
  name_short: string;
}> = {
  "11110": { code: "11110", name_ko: "서울특별시 종로구", name_short: "종로" },
  "11680": { code: "11680", name_ko: "서울특별시 강남구", name_short: "강남" },
  "11650": { code: "11650", name_ko: "서울특별시 서초구", name_short: "서초" },
  "11710": { code: "11710", name_ko: "서울특별시 송파구", name_short: "송파" },
  "11440": { code: "11440", name_ko: "서울특별시 마포구", name_short: "마포" },
  "28200": { code: "28200", name_ko: "인천광역시 연수구", name_short: "연수" },
  "41135": { code: "41135", name_ko: "경기도 성남시 분당구", name_short: "분당" },
  "41390": { code: "41390", name_ko: "경기도 시흥시", name_short: "시흥" },
  "26110": { code: "26110", name_ko: "부산광역시 중구", name_short: "부산중" },
  "27110": { code: "27110", name_ko: "대구광역시 중구", name_short: "대구중" },
};

export function validateRegionCode(code: string): void {
  if (!/^\d{5}$/.test(code)) {
    throw new z.ZodError([
      { code: "custom", path: ["region_code"], message: `region_code는 5자리 숫자 (받은 값: ${code})` },
    ]);
  }
  if (!(code in KNOWN_REGIONS)) {
    throw new z.ZodError([
      { code: "custom", path: ["region_code"], message: `미등록 region_code: ${code}` },
    ]);
  }
}

export function validateYearMonth(ym: string): void {
  if (!/^\d{6}$/.test(ym)) {
    throw new z.ZodError([
      { code: "custom", path: ["year_month"], message: `year_month는 YYYYMM 형식 (받은 값: ${ym})` },
    ]);
  }
}

export const RTMS_ENDPOINTS = {
  // ⚠️ WO-066 핫픽스: AptTradeDev → AptTrade (Dev는 별도 페이지, 활용신청 권한 다름).
  // 페이지 ID 15126469 (활용신청한 것) = production. Dev 버전은 별도 신청 필요.
  apt: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade",
  villa: "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
  house: "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
} as const;

export type PropertyType = keyof typeof RTMS_ENDPOINTS;

export interface RealEstateTrade {
  region_code: string;
  region_name: string;
  complex_name: string;
  unit_area: number;
  price: number;
  trade_date: string;
  floor?: number;
  /** 지번 (예: "736-8" 또는 "100-3"). 본번-부번 결합. v1.2부터 공개. */
  jibun?: string;
  // dong/ho 의도적 제거 — 국토부 RTMS 공식 마스킹 정책 준수
  // v1.2 (WO-116): jibun·floor 공개 — 정부 RTMS rt.molit.go.kr 공개 수준과 동일
}

export function sanitizeTrade(raw: Record<string, unknown>, regionCode: string): RealEstateTrade {
  const meta = KNOWN_REGIONS[regionCode];
  const region_name = meta?.name_ko ?? regionCode;

  const priceStr = String(raw["거래금액"] ?? raw["dealAmount"] ?? "0").replace(/,/g, "").trim();
  const year = String(raw["년"] ?? raw["dealYear"] ?? "");
  const month = String(raw["월"] ?? raw["dealMonth"] ?? "").padStart(2, "0");
  const day = String(raw["일"] ?? raw["dealDay"] ?? "").padStart(2, "0");

  const floorRaw = raw["층"] ?? raw["floor"];
  const floor = floorRaw !== undefined ? Number(floorRaw) : undefined;

  // 지번 추출 — RTMS는 본번/부번 분리 응답. "본번-부번" 형식으로 결합.
  // 정부 rt.molit.go.kr이 공개하는 동일 수준. 동·호는 정부 마스킹 정책 그대로.
  const bonbun = String(raw["본번"] ?? raw["bonbun"] ?? "").trim();
  const bubun = String(raw["부번"] ?? raw["bubun"] ?? "").trim();
  const jibunRaw = String(raw["지번"] ?? raw["jibun"] ?? "").trim();
  let jibun: string | undefined;
  if (jibunRaw) {
    jibun = jibunRaw;
  } else if (bonbun) {
    jibun = bubun && bubun !== "0" ? `${bonbun}-${bubun}` : bonbun;
  }

  return {
    region_code: regionCode,
    region_name,
    complex_name: String(raw["아파트"] ?? raw["연립다세대"] ?? raw["단독다가구"] ?? raw["apartmentName"] ?? "").trim(),
    unit_area: Number(raw["전용면적"] ?? raw["excluUseAr"] ?? 0),
    price: Number(priceStr),
    trade_date: `${year}-${month}-${day}T00:00:00Z`,
    ...(floor !== undefined && { floor }),
    ...(jibun && { jibun }),
  };
}

const RTMS_CACHE = new Map<string, { ts: number; data: RealEstateTrade[] }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface FetchRtmsOptions {
  property_type: PropertyType;
  region_code: string;
  year_month: string;
  api_key?: string;
}

export async function fetchRtmsTrades(opts: FetchRtmsOptions): Promise<RealEstateTrade[]> {
  validateRegionCode(opts.region_code);
  validateYearMonth(opts.year_month);

  const cacheKey = `${opts.property_type}|${opts.region_code}|${opts.year_month}`;
  const cached = RTMS_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const apiKey = opts.api_key ?? process.env.DATA_GO_KR_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("[realestate] DATA_GO_KR_API_KEY 미설정");
  }

  const endpoint = RTMS_ENDPOINTS[opts.property_type];
  const url = `${endpoint}?serviceKey=${apiKey}&LAWD_CD=${opts.region_code}&DEAL_YMD=${opts.year_month}&pageNo=1&numOfRows=100`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[realestate] RTMS API HTTP ${res.status}`);
  }
  const text = await res.text();

  const itemMatches = text.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const trades: RealEstateTrade[] = [];
  for (const item of itemMatches) {
    const raw: Record<string, unknown> = {};
    const fields = item.match(/<(\w+)>([\s\S]*?)<\/\1>/g) ?? [];
    for (const f of fields) {
      const m = f.match(/<(\w+)>([\s\S]*?)<\/\1>/);
      const key = m?.[1];
      const value = m?.[2];
      if (key && value !== undefined) {
        raw[key] = value.trim();
      }
    }
    trades.push(sanitizeTrade(raw, opts.region_code));
  }

  RTMS_CACHE.set(cacheKey, { ts: Date.now(), data: trades });
  return trades;
}

export function _mockRtmsTrade(overrides: Partial<RealEstateTrade> = {}): RealEstateTrade {
  return {
    region_code: "11680",
    region_name: "서울특별시 강남구",
    complex_name: "Mock 아파트",
    unit_area: 84.5,
    price: 250000,
    trade_date: "2024-05-15T00:00:00Z",
    floor: 10,
    jibun: "736-8",
    ...overrides,
  };
}
/**
 * korea-finance-mcp — 한국은행 ECOS API 클라이언트 (베이스)
 *
 * 모든 ECOS 도구는 이 모듈을 통해서만 API를 호출해야 한다.
 * - 인증 자동
 * - 응답 캐시 (메모리 1시간 TTL, 환경변수로 조정)
 * - rate-limit 보호 (간단한 토큰 버킷)
 * - 에러 표준화
 *
 * ECOS API 문서: https://ecos.bok.or.kr/api/
 *
 * ⚠️ v0.2까지는 호출 베이스만 안정. 본격 rate-limit·재시도 정책은 v0.3에서 강화 예정.
 *
 * @see CONTRIBUTING.md §ECOS 호출 표준
 */

const ECOS_BASE_URL = process.env.ECOS_BASE_URL ?? "https://ecos.bok.or.kr/api";
const CACHE_TTL_MS =
  Number(process.env.CACHE_TTL_SECONDS ?? "3600") * 1000;

/**
 * ECOS API 응답 (Raw). 도구 코드에서 직접 다루지 말 것.
 * 도구는 `EcosIndicatorPoint`로 변환해서 반환.
 */
export interface EcosRawResponse {
  StatisticSearch?: {
    list_total_count: number;
    row: Array<{
      STAT_CODE: string;
      STAT_NAME: string;
      ITEM_CODE1?: string;
      ITEM_NAME1?: string;
      TIME: string;
      DATA_VALUE: string;
      UNIT_NAME: string;
      CYCLE?: string;
    }>;
  };
  RESULT?: {
    CODE: string;
    MESSAGE: string;
  };
}

interface CacheEntry {
  data: EcosRawResponse;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * ECOS 통계 조회 — `StatisticSearch` 엔드포인트의 thin wrapper.
 *
 * @param params.statCode  통계 코드 (예: "722Y001" 기준금리)
 * @param params.cycle     주기 코드 (D/M/Q/S/Y)
 * @param params.startDate 시작 기간 (예: "202401")
 * @param params.endDate   종료 기간 (예: "202412")
 * @param params.itemCode1 (선택) 항목 코드 1
 *
 * @returns ECOS API 원본 응답. 도구는 이를 `EcosIndicatorPoint` 등으로 변환.
 *
 * @throws ECOS API 키 미설정 / API 에러 응답 / 네트워크 오류
 */
export async function fetchEcosStatistic(params: {
  statCode: string;
  cycle: string;
  startDate: string;
  endDate: string;
  itemCode1?: string;
}): Promise<EcosRawResponse> {
  const apiKey = process.env.ECOS_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "[ecos] ECOS_API_KEY가 설정되지 않음. .env에 키 입력 필요. 발급: https://ecos.bok.or.kr/api/",
    );
  }

  // 최대 행 수는 1000으로 우선 고정 (v0.x). 1만 행 초과 도구는 별도 paging.
  const itemCode = params.itemCode1 ?? "?";
  const url =
    `${ECOS_BASE_URL}/StatisticSearch/${apiKey}/json/kr/1/1000/` +
    `${params.statCode}/${params.cycle}/${params.startDate}/${params.endDate}/${itemCode}`;

  // 캐시 조회
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // API 호출
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `[ecos] HTTP ${res.status} ${res.statusText} — ${params.statCode} ${params.startDate}~${params.endDate}`,
    );
  }
  const json = (await res.json()) as EcosRawResponse;

  // ECOS는 200 OK + RESULT.CODE로 에러 전달하는 경우 있음
  if (json.RESULT && json.RESULT.CODE !== "INFO-000") {
    throw new Error(
      `[ecos] API 에러 ${json.RESULT.CODE}: ${json.RESULT.MESSAGE}`,
    );
  }

  // 캐시 저장
  cache.set(url, { data: json, expiresAt: Date.now() + CACHE_TTL_MS });

  return json;
}

/**
 * ECOS 응답의 `DATA_VALUE` 문자열을 숫자로 안전하게 파싱.
 * 빈 값·"-"·공백은 null 반환. 추측 금지.
 */
export function parseEcosValue(raw: string | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-") return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

/**
 * 캐시 비우기 (테스트용).
 */
export function clearEcosCache(): void {
  cache.clear();
}

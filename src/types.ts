/**
 * korea-finance-mcp — 표준 응답 타입
 *
 * 모든 도구는 반드시 `ToolResponse<T>` 형태로 응답해야 한다.
 * 환각 방지 양보 불가 원칙을 코드로 강제하는 1차 방어선.
 *
 * @see CONTRIBUTING.md §환각 방지 5규칙
 */

/**
 * 모든 도구 응답의 표준 구조.
 *
 * 양보 불가 필드 4개:
 * - `source`: 데이터 출처 (예: "한국은행 ECOS API")
 * - `source_url`: 공식 사이트 URL (예: "https://ecos.bok.or.kr/api/")
 * - `last_updated_at`: 데이터 기준일 (ISO 8601, 예: "2026-05-25T00:00:00Z")
 * - `disclaimer`: 면책조항 (response.ts가 자동 부착, 직접 작성 금지)
 *
 * 선택 필드:
 * - `data`: 실제 결과 (도구별 타입)
 * - `warnings`: 데이터 신뢰도·마감 임박 등 ⚠️ 표기
 * - `meta`: 추가 메타데이터 (기간·단위·계산식 등)
 */
export interface ToolResponse<T = unknown> {
  /** 데이터 출처 명칭 (예: "한국은행 ECOS API"). 절대 빈 문자열 금지. */
  source: string;

  /** 공식 사이트·문서 URL. 사용자가 직접 검증 가능해야 함. */
  source_url: string;

  /** 데이터 기준일 (ISO 8601). 도구가 API에서 받은 실제 갱신일 사용, 추측 금지. */
  last_updated_at: string;

  /** 면책조항 — response.ts의 `buildResponse()`가 자동 부착. 도구 코드에서 직접 작성 금지. */
  disclaimer: string;

  /** 실제 데이터 (도구별 타입). 데이터 없으면 null. */
  data: T | null;

  /** 데이터 신뢰도·마감·정기수정 등 경고. 한 개라도 있으면 응답 상단에 ⚠️ 표시. */
  warnings?: string[];

  /** 메타데이터 (기간·단위·계산식 등). */
  meta?: Record<string, unknown>;
}

/**
 * 데이터 없음 응답 (양보 불가 원칙).
 *
 * 도구는 추측·일반화·과거 데이터 보간 금지.
 * 데이터가 없으면 반드시 이 응답을 반환.
 */
export interface NoDataResponse extends ToolResponse<null> {
  data: null;
  warnings: ["데이터 없음 — 추측하지 않음. 공식 사이트에서 직접 확인 권장."];
}

/**
 * ECOS API의 통계 주기 코드.
 * - D: 일별, M: 월별, Q: 분기별, S: 반기별, Y: 연도별
 */
export type EcosCycle = "D" | "M" | "Q" | "S" | "Y";

/**
 * ECOS 지표 단일 시점 데이터.
 */
export interface EcosIndicatorPoint {
  /** 통계 코드 (예: "722Y001" 기준금리). */
  indicator_code: string;
  /** 한글 통계명 (예: "한국은행 기준금리"). */
  indicator_name: string;
  /** 기간 표기 (예: "2026-05" 또는 "20260525"). */
  period: string;
  /** 실제 값 (단위 별도). */
  value: number;
  /** 단위 (예: "%", "원", "지수"). */
  unit: string;
  /** 주기 코드. */
  cycle: EcosCycle;
}

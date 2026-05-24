# CONTRIBUTING — 다른 에이전트 작업 명령서

> 본 파일은 **다른 AI 에이전트(Claude Code · GPT · Cursor 등)가 단독으로 작업을 시작**할 수 있도록 작성된 명령서입니다. 첫 진입 시 본 파일과 `src/tools/get_indicator.ts` 두 개만 읽으면 됩니다.

---

## 0. 프로젝트 정체성 (필독)

`korea-finance-mcp`는 ETF Insight의 **내부 두뇌**이자 한국 AI 금융 분석의 **외부 표준**입니다. 12주 로드맵으로 ECOS(거시) → 부동산 → DART/KRX(주식)를 통합합니다. 전체 맥락은 `wiki/korea-finance-mcp/handoff.md` 참조. 운영자 호칭은 **"주인님"** (존댓말).

---

## 1. 양보 불가 원칙 (위반 시 즉시 PR 반려)

### 1.1 환각 방지 5규칙

1. **모든 응답은 `buildResponse()` 또는 `buildNoData()`로 생성** — 출처·기준일·면책 자동 부착. 직접 `return { ... }` 금지.
2. **추측 금지** — "아마도", "보통은", "일반적으로" 사용 금지. 데이터 없으면 `buildNoData()`.
3. **출처 URL은 공식 사이트만** — `https://ecos.bok.or.kr/api/`, `https://opendart.fss.or.kr/` 등.
4. **`last_updated_at`은 API 응답값 그대로** — `new Date().toISOString()`로 덮어쓰기 금지 (단, API가 안 주는 경우 예외).
5. **에러는 그대로 노출** — try/catch로 빈 응답 반환 금지. 사용자가 진실을 알아야 함.

### 1.2 절대 금지 7항목 (자본시장법·개인정보·라이선스)

| # | 금지 | 이유 |
|---|---|---|
| 1 | 주문·매매 도구 (`place_order` 등) | 자본시장법 — 투자중개업 등록 필요 |
| 2 | 종목 추천 (`recommend_stocks`) | 유사투자자문업 등록 필요 |
| 3 | 가격 예측 (`predict_price`) | 법적 + 환각 리스크 |
| 4 | 목표주가 (`get_target_price`) | 애널리스트 리포트 저작권 |
| 5 | 등기부등본 (`get_registry`) | 개인정보보호법 |
| 6 | KB시세·네이버 금융 등 민간 데이터 | 라이선스 |
| 7 | 포트폴리오 최적화 (`optimize_portfolio`) | 투자자문업 등록 필요 |

**판단 기준**: "이 도구가 정보 *제공*인가, *판단·추천*인가?" 후자는 무조건 금지.

---

## 2. 2개층 동시 작업 분할 (충돌 방지)

| 층 | 작업 영역 | 건드리는 디렉토리 | 건드리지 말 것 |
|---|---|---|---|
| **Layer A** | 도구 구현 (4개) — `get_timeseries` · `search_indicator` · `compare_indicators` · `get_dashboard` | `src/tools/*.ts` (각자 새 파일) · `src/index.ts` (도구 등록 라인 추가만) | `src/lib/*` · `tests/*` |
| **Layer B** | 환각 방지 + 회귀 테스트 — 시나리오 30개 작성 + Vitest 자동화 | `tests/regression/*.test.ts` · `tests/setup.ts` · `vitest.config.ts` (없으면 생성) | `src/tools/*` · `src/lib/*` |

**`src/index.ts`의 도구 등록 부분만 가벼운 충돌 가능** — Layer A가 도구 import + `TOOLS` 배열 push만 추가, 다른 라인 절대 수정 금지.

---

## 3. 도구 1개 추가 — 정확히 5단계

> 가장 중요한 섹션. 새 도구 만들 때 무조건 이 순서.

### Step 1. 파일 복제

```bash
cp src/tools/get_indicator.ts src/tools/<your_tool>.ts
```

### Step 2. 입력 스키마 작성 (Zod)

`<YourTool>InputSchema` — 모든 인자에 `.describe()` 필수. LLM이 도구를 선택할 때 이걸 보고 결정.

```typescript
export const SearchIndicatorInputSchema = z.object({
  query: z.string().min(1).describe("한글 검색어 (예: '기준금리', '환율', '실업률')"),
  limit: z.number().int().positive().max(50).default(10).describe("최대 결과 수 (1~50, 기본 10)"),
});
```

### Step 3. 메타데이터 등록

```typescript
export const searchIndicatorTool = {
  name: "search_indicator",
  description: "ECOS 통계 코드를 한글 키워드로 검색. get_indicator 호출 전 단계.",
  inputSchema: SearchIndicatorInputSchema,
} as const;
```

### Step 4. 핸들러 — 무조건 `buildResponse()` 사용

```typescript
export async function executeSearchIndicator(input: SearchIndicatorInput): Promise<ToolResponse<...>> {
  const validated = SearchIndicatorInputSchema.parse(input);
  const raw = await fetchEcosStatistic({ /* ... */ });
  if (!raw.StatisticSearch?.row?.length) {
    return buildNoData({
      source: "한국은행 ECOS API",
      source_url: "https://ecos.bok.or.kr/api/",
      last_updated_at: new Date().toISOString(),
    });
  }
  return buildResponse({ /* ... */ });
}
```

### Step 5. `src/index.ts`에 등록

`TOOLS` 배열에 한 항목 push만 추가. 다른 라인 수정 금지.

```typescript
import { searchIndicatorTool, executeSearchIndicator, SearchIndicatorInputSchema } from "./tools/search_indicator.js";

const TOOLS: ToolDefinition[] = [
  // ... 기존 ...
  {
    name: searchIndicatorTool.name,
    description: searchIndicatorTool.description,
    inputSchema: searchIndicatorTool.inputSchema,
    execute: async (input) => executeSearchIndicator(SearchIndicatorInputSchema.parse(input)),
  },
];
```

**완료. 빌드·테스트:**

```bash
npm run typecheck
npm run test
```

---

## 4. ECOS 호출 표준

- **무조건 `fetchEcosStatistic()` 사용** — 직접 `fetch()` 호출 금지 (캐시·rate-limit 우회됨)
- 응답값은 `parseEcosValue()`로 파싱 — `Number()` 직접 사용 금지 (빈 값·"-" 처리 누락 위험)
- 1만 행 초과 예상되면 `lib/ecos.ts`의 paging 보강을 v0.2 이슈로 등록 후 v0.x에서는 최대 1000행으로 제한

---

## 5. 커밋·PR 규칙

### 커밋 메시지 (Conventional)

```
feat(tools): add get_timeseries
fix(ecos): handle empty DATA_VALUE
test(regression): add 5 scenarios for get_indicator
docs(handoff): update tool count
```

### PR 자가 점검 체크리스트 (v0.2 강화)

**🛡 push 전 필수 — `npm run test` 실행 후 다음 3줄 모두 확인**:
- [ ] `Test Files N passed (N)` — 모든 파일 통과
- [ ] `Tests N passed (N)` — 모든 시나리오 통과
- [ ] **`Errors 0`** (또는 Errors 줄이 *아예 없음*) — unhandled rejection 없음

> ⚠️ **양보 불가 — `Tests passed`만 봐서는 안 됩니다.** Vitest는 `Errors`도 별도 카운트하며 *exit code 1* 반환. WO-005(unhandled rejection)·WO-008(disclaimer false positive) 두 사례에서 학습.

**기타 점검**:
- [ ] `npm run typecheck` 통과
- [ ] 새 도구는 `buildResponse()` 또는 `buildNoData()` 사용
- [ ] `last_updated_at`을 API 응답값에서 가져옴 (현재 시각 fallback은 `cycle === Q/S` 같은 예외만)
- [ ] 절대 금지 7항목 중 해당 없음
- [ ] `serializeForMcp` 응답 검증 시 disclaimer는 *반드시 분리*해서 검사 (`splitSerialized` 패턴, WO-008 참조)
- [ ] **회귀 시나리오 30/30 모두 통과** — v0.2 이상 유지
- [ ] `wiki/korea-finance-mcp/handoff.md` §11 진행 상태 표 갱신 (PR 본문에 mywiki 측 diff 첨부)

### 회귀 테스트 작성 가이드 (v0.2 추가)

**fake timer + reject 조합** (WO-005 패턴):
```typescript
// ❌ unhandled rejection 위험
const promise = executeXxx(...);
await vi.advanceTimersByTimeAsync(300);
await expect(promise).rejects.toThrow(...);

// ✅ promise 직후 expect로 먼저 wrapping
const promise = executeXxx(...);
const assertion = expect(promise).rejects.toThrow(...);
await vi.advanceTimersByTimeAsync(300);
await assertion;
```

**serializeForMcp 검증 시** (WO-008 패턴):
```typescript
// ❌ disclaimer의 "추천이 아닙니다"가 정규식에 잡힘 (false positive)
const text = serializeForMcp(res).content[0]!.text;
expect(text).not.toMatch(/(추천|매수|매도|...)/);

// ✅ body와 disclaimer 분리 후 본문만 검사
function splitSerialized(s: string) {
  const parts = s.split(/\n\n---\n/);
  return { body: parts[0] ?? "", disclaimer: parts[1] ?? "" };
}
const { body, disclaimer } = splitSerialized(serializeForMcp(res).content[0]!.text);
expect(body).not.toMatch(/(추천|매수|매도|...)/);
expect(disclaimer).toContain("추천이 아닙니다"); // 의도된 강화 검증
```

---

## 6. 작업 시작 전 체크리스트

- [ ] ECOS API 키 발급 완료 (`https://ecos.bok.or.kr/api/`, 1일 이내 자동 승인)
- [ ] `.env` 파일에 `ECOS_API_KEY=` 채움 (`.env.example` 복사)
- [ ] `npm install` 완료
- [ ] `npm run dev` 로 서버 정상 기동 확인 (`server v0.1.0 running — 1 tool(s) registered` stderr 출력)
- [ ] Layer A / Layer B 중 본인 담당 확인 (§2)

---

## 7. 막혔을 때

1. `wiki/korea-finance-mcp/handoff.md` 전체 다시 읽기
2. `raw/korea-finance-mcp-handoff-2026-05-25.md` 원본 핸드오프 §9 함정 8건 확인
3. 류주임 패턴 참조: https://github.com/chrisryugj/korean-law-mcp
4. cfdude/mcp-fred 참조: https://github.com/cfdude/mcp-fred
5. 그래도 막히면 GitHub Issue 작성 (label: `needs-주인님-decision`)

---

**마지막 메시지**: 도구를 **추가하는 결정보다 빼는 결정**이 더 중요할 때가 많습니다. 의심되면 본 문서 §1.2와 핸드오프 §5.3 배제 도구 30개+ 참조.

*v1 · 2026-05-25 · MC AI Labs*

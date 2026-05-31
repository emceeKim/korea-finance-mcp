# korea-finance-mcp

> **한국 첫 자본시장법-안전 금융 MCP. 1인 운영. 15 도구. 시너지 2종 (한국 유일).**
> *The first Korea-finance MCP that's legally safe to deploy. 1-person operated. 15 tools. 2 Korea-unique synergy tools.*

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![MCP](https://img.shields.io/badge/MCP-compatible-blue)
![Tools](https://img.shields.io/badge/tools-15-brightgreen)
![Korea Finance](https://img.shields.io/badge/data-Korea_Finance-red)
![Status](https://img.shields.io/badge/status-Public_v1.0-blue)

한국은행 ECOS · 국토부 RTMS · 한국부동산원 R-ONE · DART · KRX 통합 + ⭐⭐ **시너지 도구 2종 (외국 MCP 진입 불가)** + *자본시장법 4종 미등록 영구 잠금* + 환각 방지 6중 안전망.

**🎉 v1.0 Public 릴리스** (2026-05-25). Cowork · Claude Desktop · MCP Inspector · Cursor 호환 검증 완료.

---

## 무엇을 할 수 있나요

### 먼저, 이런 데이터를 조회할 수 있습니다

1. **거시경제 지표** (한국은행 ECOS) — 기준금리 · 환율 · 물가(CPI) · 통화량(M2) · GDP 등 6만+ 시계열
2. **부동산 데이터** (국토부 RTMS · 한국부동산원 R-ONE) — 아파트 · 빌라 · 단독주택 실거래가 · 지역별 주택가격지수 · 전세가율(한국 특화)
3. **기업 보고서** (DART · KRX) — 기업 공시 · 재무제표 · 종목 주가 · 시장지수(KOSPI/KOSDAQ)

### 그리고 이 데이터를 토대로 이런 분석을 해볼 수 있습니다

- **금리 ↔ 집값 상관관계** — 한국은행 기준금리와 아파트 실거래가를 *시차(예: 6개월)*를 두고 비교해, 금리 변동이 몇 개월 뒤 집값에 어떻게 반영되는지를 상관계수로 확인
- **환율·물가 ↔ 증시 흐름** — 원/달러 환율이나 CPI가 KOSPI와 어떻게 함께 움직이는지 추적
- **기업 실적 ↔ 거시 환경** — DART 재무제표로 기업 실적을 보면서, 같은 기간의 금리·경기 지표를 나란히 놓고 해석
- **주식 ↔ 부동산 상관관계** (한국 유일) — 예를 들어 건설사 주가와 특정 지역 집값의 상관을 시차와 함께 분석
- **여러 지표 한 번에 비교** — 기준금리·환율·물가 등 최대 5개 지표를 같은 기간으로 정렬해 비교

> 모든 수치는 공공 데이터 원본에 **출처 · 기준일**이 함께 붙어 제공되며, "예측 · 추천"이 아닌 **사실 데이터와 상관관계**만 제공합니다.

---

## 5분 시작 가이드

### 🅰️ Cowork (Claude Desktop) — 가장 빠름

1. Cowork → **Customize** → **Connectors** → `+` 클릭
2. URL 등록:
   ```
   https://korea-finance-mcp-divine-hillside-8872.fly.dev/mcp
   ```
3. 새 채팅 → `korea-finance MCP의 get_indicator로 722Y001 (한국 기준금리) 조회`
4. **2.5% (한국은행 기준금리)** 즉시 응답 ✅

### 🅱️ Claude Code / Cursor / 기타 MCP 클라이언트

`claude_desktop_config.json` 또는 동등 설정:
```json
{
  "mcpServers": {
    "korea-finance": {
      "url": "https://korea-finance-mcp-divine-hillside-8872.fly.dev/mcp"
    }
  }
}
```

### 🅲 자체 호스팅 (오픈소스 fork)

```bash
git clone https://github.com/emceeKim/korea-finance-mcp.git
cd korea-finance-mcp
npm install
cp .env.example .env  # ECOS_API_KEY, DATA_GO_KR_API_KEY, DART_API_KEY 등록
npm run build
npm start  # 또는 npm run start:http for remote deployment
```

---

## 🎯 15 도구 (한 화면 요약)

| 카테고리 | 도구 | 데이터원 | 차별화 |
|---|---|---|---|
| **거시 (5)** | `get_indicator` / `search_indicator` / `get_timeseries` / `compare_indicators` / `get_dashboard` | 한국은행 ECOS | KNOWN_INDICATORS 정적 사전 (추측 금지) |
| **부동산 (4)** | `get_realestate_price` / `get_housing_index` / `get_jeonse_ratio` / **`correlate_macro_realestate`** ⭐ | 국토부 RTMS + R-ONE | dong/ho/jibun 자동 제거 (정부보다 1단계 보수적) |
| **주식 (6)** | `get_disclosure` / `get_financials` / `get_stock_price` / `get_market_index` / **`correlate_macro_stock`** ⭐ / **`correlate_stock_realestate`** ⭐⭐ | DART + KRX | **한국 유일** 시너지 (외국 MCP 진입 불가) |

### ⭐⭐ 시너지 도구의 진짜 차별화

`correlate_stock_realestate`는 **한국 ECOS + 부동산 + 주식 데이터를 모두 통합한 후에만** 가능합니다. 외국 MCP는 한국 데이터에 접근 못해서 **구조적으로 진입 불가**. 4중 방벽 전략의 핵심 (자본시장법 + 시너지 + 6중 안전망 + 사전 잠금).

---

## 🛡 자본시장법 영구 금지 7건 (우리 차별화 = 안전 보장)

| 금지 도구 | 법적 근거 |
|---|---|
| `place_order` | 자본시장법 §11 투자중개업 미등록 |
| `recommend_stocks` | §101 유사투자자문업 미등록 |
| `predict_price` / `get_target_price` | §178 부정거래 회피 + 환각 |
| `optimize_portfolio` / `manage_portfolio` | §6 투자자문업 / §18 투자일임업 미등록 |
| `get_orderbook` (실시간 호가) | 한국거래소 라이선스 |

**경쟁자가 "왜 못하지?"라 묻는다면, 우리는 "처음부터 안 하기로 했다. 그래서 안전하다"라고 답합니다.** 이게 차별화입니다.

---

## ✅ 운영 중 보안 (v1.0 Public 기준)

- ✅ Rate limit: 30 req/분/IP (`-32029` JSON-RPC 표준 에러)
- ✅ 세션 max age: 30분 자동 정리 (메모리 누수 방지)
- ✅ API 키 5중 방어 (.env + .gitignore + Fly.io secrets + grep 검증 + git history clean)
- ✅ HTTPS 강제 (Fly.io 기본)
- ✅ Stateful 세션 UUID (cryptographically random)
- ✅ Zod 입력 검증 (모든 도구)
- ✅ 환각 차단 (KNOWN_INDICATORS / REGIONS / COMPANIES / TICKERS 정적 사전 + `expected_range` healthcheck)

## ⏳ 백로그 (v1.1 예정)

- DNS rebinding 보호 (ALLOWED_HOSTS, Fly 헬스체크 호환 검증 후)
- Cloudflare 프록시 (uptime 7일 후)
- KNOWN_COMPANIES / TICKERS TOP 50 데이터 채움 (DART corpCode.xml 역검증)
- v3.1 지분공시 (DS004) + 증권신고서 (DS006)

---

## 한 줄 정의

ETF Insight의 "내부 두뇌"이자 한국 AI 금융 분석의 "외부 표준" — 12주 로드맵을 *1일 마라톤 + 9주 단축*으로 종결한 1인 기업의 첫 자본시장법-안전 금융 MCP.

## 기술 스택

- **언어**: TypeScript
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **런타임**: Node.js
- **배포**: Fly.io
- **CI/CD**: GitHub Actions
- **검증**: Zod
- **데이터 누적**: Supabase (ETF Insight 공유)

## 데이터 소스 (공공 API만)

- 한국은행 ECOS — https://ecos.bok.or.kr/api/
- 국토교통부 실거래가 — https://www.data.go.kr
- 한국부동산원 R-ONE — https://www.r-one.co.kr/
- DART OpenDART — https://opendart.fss.or.kr/
- KRX — http://data.krx.co.kr/

## 라이선스

[MIT License](LICENSE) — Copyright (c) 2026 MC AI Labs

## 🔒 Privacy Policy (요약)

본 MCP 서버는 **익명화 통계만 수집**합니다 (호출 도구명·시각·응답시간·결과코드·입력해시·국가). 사용자 식별 정보·입력 본문·응답 본문은 *저장하지 않습니다*.

- 보관 기간: 90일 (자동 삭제)
- 사용 목적: 도구 개선 + Rate limit 정책 설계만
- GDPR / PIPA 비식별 통계 범주 준수

전체 정책: [PRIVACY.md](./PRIVACY.md) · 보안 신고: [SECURITY.md](./SECURITY.md) · 행동 강령: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) · 변경 이력: [CHANGELOG.md](./CHANGELOG.md)

⚠️ **자체 호스팅 시**: 본 정책은 기본 코드에서 *로깅 0건*을 가정합니다. 자체 배포 시 본인의 프라이버시 정책 필요.

## ⚠️ 면책조항 (Disclaimer) — v0.2 강화

본 서비스는 **한국은행 ECOS · 국토교통부 · DART · KRX 등 공공 데이터 조회 서비스**이며,
**투자 자문 · 권유 · 추천이 아닙니다**.

본 서비스 운영자(MC AI Labs)는 **자본시장법상 다음 업종 중 어느 것에도 등록된 사업자가 아닙니다**:
- 투자중개업
- 투자자문업
- 유사투자자문업
- 투자일임업

**모든 투자 · 재무 판단과 그에 따른 손익은 사용자 본인의 책임**입니다.
**법률 · 세무 · 투자 자문이 필요하시면 자격을 갖춘 전문가에게 문의하십시오.**
공식 사이트에서 최종 확인을 권장합니다.

### 추가 명시 사항

- 본 서비스는 **데이터의 정확성을 보장하지 않습니다** — 원천 API의 갱신 지연·오류·정정 가능성이 있습니다.
- 본 서비스는 **가격 예측 · 종목 추천 · 목표주가 · 포트폴리오 운용 도구를 제공하지 않습니다** (의도적 배제).
- 본 서비스 응답을 근거로 발생한 어떠한 손해에 대해서도 운영자는 책임지지 않습니다.
- 본 라이선스(MIT)는 사용·복제·수정·배포를 허용하나, **본 면책조항의 효력은 라이선스와 별개로 유지됩니다**.

## 운영 원칙 (양보 불가)

1. **법적 회색지대 절대 진입 금지** — 주문·추천·예측·목표주가 도구 없음
2. **환각 방지** — 모든 응답에 출처 + 기준일 표기, "아마도/보통은" 금지, 데이터 없으면 "데이터 없음"
3. **회귀 테스트 30개** — 매 배포 자동 실행, 환각 1건 발생 시 즉시 롤백
4. **도구는 빼는 결정이 우선** — 진입장벽 30개+ 명시적 배제

## 개발 가이드

### pre-push hook 활성화 (v0.2 권장)

```bash
git config core.hooksPath .githooks
```

이후 `git push` 시 자동으로 `npm run typecheck` + `npm run test` 실행, 실패 시 push 차단. WO-005·WO-008 학습 기반 영구 안전망. 상세는 [CONTRIBUTING.md §6](CONTRIBUTING.md) 참조.

## 배포 (Fly.io · v0.4)

### 이중 entry 패턴

| Entry | Transport | 용도 |
|---|---|---|
| `src/index.ts` | stdio | 로컬 Claude Desktop / IDE (`npm start`) |
| `src/http.ts` | StreamableHTTP | 원격 (Fly.io 등, `npm run start:http`) |

→ stdio→HTTP *전환*이 아니라 **이중 entry**. 회귀 위험 0, 도구 5종 동일하게 노출.

### Fly.io 첫 배포 (5단계)

```bash
# 1) Fly CLI 설치 (Windows)
iwr https://fly.io/install.ps1 -useb | iex

# 2) 로그인
fly auth login

# 3) 앱 생성 (fly.toml 유지, --no-deploy로 secrets 먼저 설정)
fly launch --no-deploy --copy-config

# 4) Secrets 등록 (ECOS API Key + 허용 호스트)
fly secrets set ECOS_API_KEY=<주인님_키>
fly secrets set ALLOWED_HOSTS="<app-name>.fly.dev"

# 5) 배포
fly deploy
```

### 헬스체크 + uptime 측정

```bash
curl https://<app-name>.fly.dev/healthz
# → {"status":"ok","service":"korea-finance-mcp","version":"0.1.0","tools":5,...}
```

→ v1.0 Public 조건 #4 `uptime 7일` 측정 기준점. `min_machines_running = 0` (콜드 스타트 허용)으로 비용 최소화.

### 환경변수

| 변수 | 기본값 | 비고 |
|---|---|---|
| `PORT` | `8080` | Fly.io는 내부 8080 → 외부 443 (force_https) |
| `HOST` | `0.0.0.0` | Fly.io 필수 |
| `ALLOWED_HOSTS` | (없음) | DNS rebinding 방어. 콤마 구분. 비우면 자동 비활성 |
| `ECOS_API_KEY` | (필수) | ECOS Open API 인증키 |

## 운영자

**MC AI Labs** (1인 기업) — 유니콘 1인 기업 목표
- 본 프로젝트는 ETF Insight(웹 서비스)와 시너지 운영
- 핸드오프 문서: `wiki/korea-finance-mcp/handoff.md` (mywiki 저장소)

---

*Status*: Private repo · **v0.1.0** (v1.0 거시 5/5 ✅ · 회귀 30/30 + e2e 5/5 · CI 14회 · 6중 안전망 · 사전 잠금 100%) · 2026-05-25

## 차별화 (vs 경쟁 MCP)

| 항목 | korea-finance-mcp | 다른 한국 금융 MCP |
|---|---|---|
| ECOS 거시 (5종) | ✅ 6만+ 시계열, KNOWN_INDICATORS 정적 사전 | 없음 (단독) |
| 시너지 도구 2종 (v3.0) | ⭐⭐ correlate_macro_stock + **correlate_stock_realestate** | 없음 (한국 유일) |
| **자본시장법 4종 영구 잠금** | ✅ CI 코드 정적 차단 | 미확인 (B2B 리스크) |
| **응답 키워드 차단** (예측/추천/목표주가) | ✅ 회귀 st-10~13 (변경 불가) | 미확인 |
| 개인정보 dong/ho/jibun 자동 제거 | ✅ 정부보다 1단계 보수적 | 미확인 |
| 추측 금지 정적 사전 (KNOWN_*) | ✅ API 역검증 통과만 등록 | 직접 추정 케이스 다수 |

→ B2B 도입 시 *법무 검토 통과 가장 빠른 옵션*. 자세히: [wiki/korea-finance-mcp/competition-monitoring.md](https://github.com/emceeKim/mywiki/blob/main/wiki/korea-finance-mcp/competition-monitoring.md)

## 작업 흐름 안내 (후속 에이전트용)

1. `wiki/sessions/2026-05-25-korea-finance-mcp-week1-marathon-digest.md` — **15분이면 전체 상태 파악**
2. `CONTRIBUTING.md §8` — 새 도구 추가 13단계 체크리스트
3. `wiki/korea-finance-mcp/handoff.md §11` — 진행 상태 (Living)
4. `wiki/korea-finance-mcp/work-orders.md` — 최상단 WO부터 역시간순

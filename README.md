# korea-finance-mcp

**한국 금융 MCP (Model Context Protocol)** — ECOS · 부동산 · DART · KRX 통합 + ⭐ **시너지 도구 2종**

> AI 금융 분석을 위한 한국 표준 MCP 서버. *자본시장법 4종 미등록 영구 잠금* + 환각 방지 6중 안전망.
> ✅ **현재 v0.2.0 (Private + Fly.io 운영 중)** — 9 도구 활성 (v1.0 거시 5 + v2.0 부동산 4). Cowork·Claude Desktop 호환 검증 완료 (WO-069/070).
>
> 🚨 **외부 사용 미권장 (1인 운영 단계)**: 현재 *주인님 개인 사용 + 소규모 검증* 단계입니다. 일반 사용자 호출은 **v1.0 Public 전환 D-day (2026-06-01 잠정)** 이후 권장합니다.
> 
> **현재 미도입 보안 항목** (locked D-day에 4건 일괄 도입 예정):
> - Rate limit 0 → 트래픽 폭주 시 Fly.io 머신 다운 가능
> - DoS 무방어 → Cloudflare 프록시 미적용 (uptime 7일 후 도입)
> - 세션 max age 0 → 메모리 누수 가능 (장기 운영 시)
> - DNS rebinding 미방어 → `allowedHosts` 미설정
> 
> **현재 안전 항목** (이미 ✅):
> - API 키 5중 방어 (.env + .gitignore + Fly.io secrets + 코드 grep 검증 + 에러 메시지 검증 모두 통과)
> - 자본시장법 영구 금지 7건 (코드 진입 자체 차단)
> - 부동산 dong/ho/jibun 자동 제거 (정부 정책보다 1단계 보수적)
> - HTTPS 강제 (Fly.io 기본)
> 
> 자세히는 `wiki/decisions/korea-finance-mcp-security-policy-2026-W22.md` 참조.

## 한 줄 정의

ETF Insight의 "내부 두뇌"이자 한국 AI 금융 분석의 "외부 표준" — 12주 로드맵 + *자본시장법 안전망*이 진짜 차별화.

## 1주차 마라톤 결과 (2026-05-25)

| 지표 | 결과 |
|---|---|
| v1.0 거시 도구 | **5/5 완성** (get_indicator, search_indicator, get_timeseries, compare_indicators, get_dashboard) |
| 회귀 시나리오 | 30 완료 + 25 사전 명세 = **55** (v3.0 출시 시점 67) |
| e2e 테스트 | **5/5 실제 ECOS 호출 통과** |
| CI 통과 | **14회** (1 fail history) |
| 6중 안전망 | code throw + assertStandardResponse + 회귀 + CI guard×2 + pre-push hook + e2e |
| 핫픽스 | 7건 모두 영구 룰화 |
| 영구 금지 도구 | **16건 CI 정적 차단** + 13건 문서 차단 |
| 사전 잠금 | 부동산 정책 + 주식 정책 (decisions/, pre-locked, D-day 5주차/9주차) |

## 로드맵 (12주 → 최대 9주 가능성)

| 단계 | 주차 | 버전 | 산출 | 도구 누적 | 상태 |
|---|---|---|---|---|---|
| 거시 (ECOS) | 1~4 | v0.1 → v1.0 | 기준금리·환율·CPI·M2·GDP 등 6만+ 시계열 | 5 | 🎉 **5/5 ✅** |
| 부동산 | 5~8 | v1.1 → v2.0 | 국토부 실거래가·R-ONE·전세가율 + **`correlate_macro_realestate`** ⭐ | 9 | 📋 Phase A 완료 |
| 주식 | 9~12 | v2.1 → v3.0 | DART·KRX + **`correlate_macro_stock`** + **`correlate_stock_realestate`** ⭐⭐ | 15 | 📋 Phase A 완료 |

→ ⭐ 시너지 도구가 진짜 경쟁력. 단일 데이터 도구는 thin wrapper (외국 MCP 진입 방벽).

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

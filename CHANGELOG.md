# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning by [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for v1.2
- ⏳ Cloudflare proxy + ALLOWED_HOSTS 활성화 (uptime 7일 후)
- ⏳ 시너지 도구 정밀화 (lag 자동 탐지, 3 도구)
- ⏳ Anthropic MCP Directory 제출 (후순위)

## [1.1.0] — 2026-05-31 🆕 v1.1 — DART DS004 지분공시 2 도구 추가 = 17 도구

### Added
- **2 new DART DS004 tools** (자본시장법 §147~149 *조회만*, 해석·예측 X):
  - `get_major_holdings` — 대량보유 상황 보고 (5% 룰, §147)
  - `get_executive_holdings` — 임원·주요주주 소유 보고 (§148·149)
- `KNOWN_TICKERS` 30건 등록 — KOSPI 20 + KOSDAQ 10 (KRX 공시 검증)
- `KNOWN_COMPANIES` 2건 등록 — 삼성전자·SK하이닉스 (DART corp_code 검증)
- `findCorpCodeByTicker` 헬퍼 — ticker → corp_code 매핑
- `src/lib/dart.ts`: `fetchDartMajorStock` + `fetchDartExecutiveStock` (캐시 1시간, INFO-200 패턴)

### Changed
- README: 15 도구 → **17 도구** 표 갱신. "무엇을 할 수 있나요" 사용자 친화 도입부 추가.
- README: 1일 마라톤 + 로드맵 12주 표 제거 (대중성 ↑).
- PRIVACY: 네이버 컨셉 — "수집 안 함" 약속 제거, "수집 가능 카테고리" 명시.
- src/http.ts: `app.set('trust proxy', 1)` 추가 — Fly.io 프록시 신뢰 → 실제 사용자 IP 식별.

### Security
- **Express trust proxy 핫픽스**: express-rate-limit이 X-Forwarded-For 정확 인식 → 분산 공격 방어.

### Internal
- WO-110: README + trust proxy + PRIVACY 통합 핫픽스
- WO-111: KNOWN_TICKERS 30건 데이터 추가
- WO-112: DART DS004 2 도구 추가
- WO-113: DNS rebinding 보호 코드 검증 (활성화 deferred)

## [0.3.0] — 2026-05-25 🎉 v3.0 Stock 6 Tools + 2 Synergy = 15 Tools Complete

### Added
- **Stock 6 tools** (v3.0 complete):
  - `get_disclosure` — DART 공시 목록 (DS001+DS002+DS005, KNOWN_COMPANIES 매핑)
  - `get_financials` — DART 재무제표 (DS003, 단일·연결, XBRL 원문)
  - `get_stock_price` — KRX 일별 주가 (공공데이터포털 경유, data_as_of_date 필수)
  - `get_market_index` — KRX KOSPI/KOSDAQ/KOSPI200 일별 지수
  - ⭐ `correlate_macro_stock` — ECOS × KRX synergy (Pearson + lag + 주가 월간 변환, MANDATORY_NOTES 4건)
  - ⭐⭐ `correlate_stock_realestate` — **Korea-unique** KRX × R-ONE synergy (narrative + MANDATORY_NOTES 5건)
- `src/lib/dart.ts` (DART OpenAPI client, 4 endpoints + sanitize + cache)
- `src/lib/krx.ts` (KRX OpenAPI client via data.go.kr, 2 endpoints + sanitize realtime keywords)
- `src/lib/stock-dictionaries.ts` (KnownCompanyMeta + KnownTickerMeta interface, 데이터는 API Key 발급 후 채움)
- Regression tests: 19 new scenarios (st-01~14) across 7 new test files
- `wiki/korea-finance-mcp/v3-roadmap-detailed.md` (5 Phase + 14 step decomposition)

### Changed
- TOOLS array: 9 → **15 tools** (src/index.ts + src/http.ts both)
- README: 9 → 15 tools breakdown + synergy tool emphasis
- Total regression scenarios: 71 → 90

### Permanent Exclusions Reconfirmed (Capital Markets Act)
- ❌ `place_order` / `recommend_stocks` / `predict_price` / `get_target_price`
- ❌ `optimize_portfolio` / `manage_portfolio` / `get_orderbook` (realtime)

## [0.2.0] — 2026-05-25 🏘️ v2.0 Real Estate + 🏆 Cowork Compatible

## [0.2.0] — 2026-05-25 🏘️ v2.0 Real Estate + 🏆 Cowork Compatible

### Added
- **Real Estate 4 tools** (v2.0 complete):
  - `get_realestate_price` — Korea Ministry of Land RTMS (apt/villa/house)
  - `get_housing_index` — Korea Real Estate Board R-ONE monthly index
  - `get_jeonse_ratio` — Korea-specific jeonse-to-sale ratio
  - ⭐ `correlate_macro_realestate` — Pearson correlation + lag (Korea-unique synergy)
- **WO-069**: Stateful MCP transport (`StreamableHTTPServerTransport`) — Cowork·Claude Desktop·MCP Inspector·Cursor 호환
- **WO-070**: ECOS multi-item handling — `KnownIndicatorMeta` interface (multi_item/default_item_code1/expected_range)
- Tool annotations on all 9 tools (Anthropic Connectors Directory required)
- `PRIVACY.md` (anonymized statistics only, 90-day retention)
- `SECURITY.md` (vulnerability reporting + response SLA)
- `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1)
- Fly.io deployment (NRT region, auto_stop_machines)

### Changed
- `src/http.ts`: `app.all('/mcp')` → `app.post/get/delete('/mcp')` 3-route split with session map
- `KNOWN_INDICATORS` 722Y001: `unit "%" → "연%"`, `cycle "D" → "M"` (WO-070 actual ECOS UNIT_NAME)
- README: added "external use not recommended (1-person operated)" warning + security item separation

### Fixed
- **WO-066**: `RTMSDataSvcAptTradeDev` → `RTMSDataSvcAptTrade` (production endpoint)
- **WO-076**: regression #1 hotfix (search_indicator.test.ts unit/cycle assertion)

### Security
- All API keys via `.env` + Fly.io secrets (5-layer defense verified)
- `git log -S "ECOS_API_KEY="` clean (no value leak in history)
- HTTPS enforced (Fly.io default)
- Stateful session UUIDs (cryptographically random)

## [0.1.0] — 2026-04-28 ~ 2026-05-15 🎉 v1.0 Macro 5/5 Complete

### Added
- **Macro 5 tools** (v1.0 complete):
  - `get_indicator` — Single ECOS indicator current value
  - `search_indicator` — Static dictionary lookup (anti-hallucination)
  - `get_timeseries` — Time series query
  - `compare_indicators` — Multi-indicator comparison (2~5)
  - `get_dashboard` — Curated KPI snapshot
- 71 regression tests + 5 e2e tests (real ECOS API)
- `KNOWN_INDICATORS` static dictionary (4 entries verified via ECOS StatisticTableList)
- CONTRIBUTING.md §8 14-step code-entry checklist
- Twin-repo strategy (Private + Public switch on D-day)
- 6-layer safety net (code throw + assertStandardResponse + regression + CI guard×2 + pre-push hook + e2e)
- Pre-locked decisions (real estate / stock data policy)

### Security
- `.gitignore` 4-pattern protection (`.env` / `.env.local` / `.env.*.local` / `*.env`)
- STANDARD_DISCLAIMER auto-attachment (all responses)
- Capital Markets Act compliance: 7 tools permanently excluded

---

[Unreleased]: https://github.com/emceeKim/korea-finance-mcp/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/emceeKim/korea-finance-mcp/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/emceeKim/korea-finance-mcp/releases/tag/v0.1.0

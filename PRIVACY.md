# Privacy Policy

**Last updated**: 2026-05-25
**Project**: korea-finance-mcp v0.2.0
**Operator**: MC AI Labs (mckim890@gmail.com)

## 1. What we collect

This MCP server collects **anonymized statistics only** to improve tool quality and manage rate limits:

| Data | Purpose | Retention |
|---|---|---|
| Tool name (e.g., `get_indicator`) | Usage frequency analysis | 90 days |
| Timestamp (UTC) | Time-of-day patterns | 90 days |
| Response time (ms) | Performance monitoring | 90 days |
| Result code (`OK` / `INFO-200` / `ERROR_*`) | Error pattern detection | 90 days |
| SHA-256 hash of input | De-duplicated query frequency (irreversible) | 90 days |
| Client country (derived from IP, country-only) | Geographic distribution | 90 days |

## 2. What we do NOT collect

- ❌ User identifiers (email, name, account)
- ❌ Authentication tokens or API keys
- ❌ Input contents (only SHA-256 hashes, irreversible)
- ❌ Response contents (only success/error codes)
- ❌ Session IDs (`Mcp-Session-Id` is server-internal only)
- ❌ Anthropic-side user information (we never receive this)
- ❌ Full IP addresses (only country-level derived)

## 3. How we use it

Aggregate statistics power:
- Tool improvement priorities (which tools are used most)
- Rate-limit policy design (peak hours, anomaly detection)
- Public dashboards (e.g., "total monthly calls", anonymized)

## 4. Third-party services

This server forwards data requests to **publicly available Korean government APIs**:
- Bank of Korea ECOS — https://ecos.bok.or.kr
- Korea Ministry of Land RTMS — https://www.data.go.kr
- Korea Real Estate Board R-ONE — https://www.r-one.co.kr

We do not enrich or alter the response data. Each upstream provider has its own privacy policy.

## 5. Data retention & deletion

- All anonymized statistics are auto-deleted **90 days** after collection
- We do not store data beyond this window
- No user-initiated deletion request needed (all data is already anonymized)

## 6. Compliance

This policy aims to comply with:
- **GDPR** (EU General Data Protection Regulation) — anonymized statistics fall under recital 26
- **PIPA** (Korea Personal Information Protection Act) — no personal data collected
- **Anthropic Connectors Directory** privacy policy requirements

## 7. Changes to this policy

Material changes will be:
- Announced in `CHANGELOG.md`
- Reflected in this file's `Last updated` field
- Posted to GitHub Issues for public visibility

## 8. Contact

Questions or concerns: **mckim890@gmail.com**

Security issues: see [SECURITY.md](./SECURITY.md)

---

## 9. Self-hosting notice

If you self-host this MCP server (clone & deploy your own instance), **the above policy does not automatically apply to your deployment**. You are responsible for your users' data and must publish your own privacy policy.

The default code does not log any data unless you explicitly enable logging (see [decisions/...usage-logging-policy](https://github.com/emceeKim/mywiki/blob/main/wiki/decisions/korea-finance-mcp-usage-logging-policy-2026-W22.md)).

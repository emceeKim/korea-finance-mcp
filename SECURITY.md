# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | ✅ (current) |
| 0.1.x   | ❌ (use 0.2.x) |
| < 0.1   | ❌ |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it **privately**:

📧 **mckim890@gmail.com**

Include in your report:
1. Type of issue (e.g., API key leak, injection, DoS, misconfiguration)
2. Affected file/endpoint
3. Steps to reproduce
4. Potential impact
5. Suggested mitigation (if any)

## Response Timeline

| Severity | First response | Patch target |
|---|---|---|
| **Critical** (API key leak, RCE, data exfiltration) | 24 hours | 48 hours |
| **High** (auth bypass, persistent DoS) | 48 hours | 1 week |
| **Medium** (rate-limit bypass, info disclosure) | 1 week | 2 weeks |
| **Low** (best-practice deviation) | 2 weeks | Next minor release |

We will acknowledge your report within **24 hours** and provide a detailed response within **48 hours**.

## Disclosure Policy

- **Coordinated disclosure preferred**: we ask you to wait until a fix is published before public disclosure.
- **Credit**: with your permission, we will credit you in `CHANGELOG.md` and release notes.
- **No bug bounty currently** (1-person operated, pre-revenue). May change after v1.0 Public.

## Out of Scope

The following are **not vulnerabilities** in this project:
- **Korean government API outages** (ECOS / RTMS / R-ONE) — please report to the respective agency
- **Anthropic Cowork/Claude Desktop client bugs** — please report to Anthropic
- **MCP protocol design issues** — please report to https://modelcontextprotocol.io
- **Self-hosted deployment misconfigurations** — your responsibility (see PRIVACY.md §9)

## Known Security Posture (transparency)

Current limitations (will be addressed by v1.0 Public D-day, 2026-06-01 잠정):
- ⚠️ Rate limiting not yet enabled (DoS vector)
- ⚠️ Session max age not enforced (memory leak vector)
- ⚠️ DNS rebinding protection not enabled
- ⚠️ No Cloudflare or WAF in front of Fly.io

Already addressed:
- ✅ API keys via `.env` + Fly.io secrets (5-layer defense)
- ✅ HTTPS enforced (Fly.io default)
- ✅ Stateful session IDs (cryptographic UUID)
- ✅ Input validation (Zod + KNOWN_REGIONS/INDICATORS dictionaries)
- ✅ Capital Markets Act compliance (7 tools permanently excluded)

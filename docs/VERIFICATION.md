# MVP1 verification — 2026-09-12

## Passed

- `npm run lint` — no errors or warnings.
- `npm run typecheck` — strict TypeScript passes.
- `npm test` — 40 tests across simulator, portfolio, tools, local Copilot and storage.
- Clean Docker production build using `npm ci` and Next.js 16.3.5.
- Production container starts as non-root and serves landing/dashboard over loopback.
- `node scripts/smoke.mjs` against both development and production: landing, dashboard, address validation, live BTC/HYPE prices, real Hyperliquid account normalization, keyless calculator preview and voice 503 fallback.
- Browser flow: Try demo → $50/day → BTC 65% / HYPE 35% → 1.1x → 12 months → Preview → Save. Saved strategy survives reload and populates the builder.
- Browser Copilot command “Simulate $50/day” returns deterministic results and opens the preview; voice without a key shows a clear fallback without requesting a microphone.
- Browser address validation and successful real standard account lookup; empty account displayed as $0 with no fabricated positions.
- Responsive viewport around 390 × 844: no horizontal document overflow; portfolio, builder and scrollable preview render correctly, Copilot collapsed by default.
- Source scan: no credential patterns detected; `.env*` excluded except `.env.example`; source contains no trading/signing endpoints.

## Not verified / release boundaries

- No OPENAI_API_KEY was supplied. Live paid Responses and GPT-Live calls, microphone/audio playback, interruption handling and AI-generated insights have not been exercised with a real OpenAI project. The integration code is present, but this is not a claim that those live paths have passed end-to-end testing.
- No physical iPhone test; responsive browser viewport was used.
- Network outage handling exists, but all possible upstream failure modes are not covered by browser tests.
- Public source repository: https://github.com/Novals83/dca-ai. Publication does not deploy the application or enable trading.
- Cloud subscriptions, authentication, tenant isolation and billing remain MVP2, as documented in ROADMAP.md.

Local development: http://localhost:3100
Local production: http://localhost:3101


## Live activation — 2026-09-12

- Project key loaded at runtime from ignored local `.env`; never included in source or image.
- Both configured models returned HTTP 200 from the OpenAI models endpoint.
- Browser WebRTC session creation returned HTTP 201 and reached `listening` after `session.started`; test session was stopped. Spoken reply quality and a full spoken delegation round trip still require a user microphone conversation.
- Text Copilot returned `provider: openai` and `get_market_prices` with live BTC/HYPE prices.
- Market quotes now refresh independently of the demo portfolio every 15 seconds. Fetch failures are labeled; AI context does not silently substitute demo quotes.

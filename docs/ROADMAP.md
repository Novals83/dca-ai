# One product, two ways to run it

## MVP1: Community — current

MIT open-source code; self-hosting via Docker; local anonymous storage; deterministic portfolio and strategy tools; optional own OpenAI key. Everything required for the local product stays in this repository. No artificial feature lock or pretend checkout.

Domain logic (`lib/dca`) is independent of UI, market adapters and storage. `StrategyStorage` provides asynchronous load/save/remove operations so a later server adapter can replace localStorage. Live uses a VoiceProvider interface. OpenAI is a server-only integration.

## MVP2: Cloud subscription — planned, not implemented

Managed hosting for the same open-source product. Subscription pays for hosting, storage, included AI allowance and support, rather than hiding financial calculation logic.

1. Authenticated accounts and verified sessions; user-owned portfolios and strategies.
2. PostgreSQL/Supabase strategy adapter with tenant isolation, migrations, backups and deletion/export controls.
3. Server-side entitlements and AI quotas, persistent rate limiting and per-user usage accounting.
4. Subscription checkout and billing webhooks with idempotency, signature checks and tested cancellation/reconciliation.
5. Staging, TLS, monitoring, error handling and production release process.

No billing, cloud deployment, authentication or paid plans are claimed to work in this MVP.

## Later

Unified-account reconciliation; broader Hyperliquid coverage; actual calendar schedules; historical backtesting; richer voice evaluations. Any trade execution is a separate future project requiring explicit authorization, security review and testing. There is no trading endpoint to enable via a flag today.

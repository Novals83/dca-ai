# DCA AI — Hyperliquid Copilot

[Public repository](https://github.com/Novals83/dca-ai)

Local-first portfolio intelligence and BTC + HYPE accumulation simulations. Manual, wallet-confirmed mainnet spot purchases are available in DCA setup. Recurring execution is not connected yet; private keys stay in your wallet. The community edition is MIT licensed and free to self-host. OpenAI API use is billed separately to your own account.

## Run in a fresh container

Requires Docker Desktop / Docker Engine with Compose. No local Node installation needed.

```sh
cp .env.example .env
# Optionally add OPENAI_API_KEY to .env; never commit this file.
docker compose up -d --build
```

Open [localhost:3100](http://localhost:3100). The port binds to loopback only. The app container has independent dependency and Next.js cache volumes. Source changes reload automatically.

```sh
docker compose logs -f web
docker compose down
```

After changing `.env`, run `docker compose up -d --force-recreate`.

## What works

- Responsive landing and dashboard; demo portfolio balances with live BTC/HYPE market quotes, refreshed every 15 seconds.
- Public master/subaccount address input, standard main DEX perp equity, spot balances, net BTC/HYPE exposure, positions, open orders and recent fills in API context.
- Live BTC perp mid and HYPE spot mid; HYPE resolves through spot metadata and pair indexes, not a hardcoded spot symbol.
- Daily, weekly and monthly DCA, initial capital, 0–100% allocation, 1–24 months, 1–1.2x modeled leverage.
- Deterministic bear/base/bull scenarios, contributions and debt-aware equity; charts are hypothetical future paths, not historic performance.
- Preview then save, per-address browser storage, delete and JSON export. Saved strategies never schedule orders.
- Text Copilot via server-side OpenAI Responses with seven calculator/context tools and bounded tool loops.
- Without a key or during OpenAI errors: clearly marked local calculator, portfolio summary and risk explanations. This fallback is not an AI and supports limited commands.
- GPT-Live-1 WebRTC connection, transcript events, client delegation into the same backend and graceful text fallback. Voice is AI-generated.

## Configuration

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Server-only project key for chat and voice; optional for local calculator |
| `OPENAI_REASONING_MODEL` | Text/tool backend, default `gpt-5.4-mini`; choose a Responses-compatible model available to your project |
| `OPENAI_LIVE_MODEL` | Voice model, default `gpt-live-1`; requires model access |

The public Hyperliquid URLs in `.env.example` document the network defaults. The MVP server deliberately uses the fixed official mainnet info URL; it does not accept arbitrary remote endpoints. No OpenAI key reaches client JavaScript or the Docker build. No Supabase or cloud account is required.

## Verification

```sh
docker compose exec web npm run lint
docker compose exec web npm run typecheck
docker compose exec web npm test
docker compose exec web npm run build
```

Production image (separate from the development server):

```sh
docker build --target production -t dca-ai:0.3.0 .
docker run --rm --name dca-ai-production -p 127.0.0.1:3101:3000 --env-file .env dca-ai:0.3.0
```

Open [localhost:3101](http://localhost:3101). `.env` is optional; omit `--env-file` for a keyless launch.

## Model assumptions and limits

See [calculation methodology](docs/CALCULATIONS.md), [architecture and editions](docs/ROADMAP.md), [upstream sources](docs/SOURCES.md) and [verification report](docs/VERIFICATION.md).

Only standard Hyperliquid accounts are supported. Unified accounts, portfolio margin and DEX abstraction are explicitly rejected rather than presenting unreconciled equity. Vaults, staking, HIP-3 DEXs and linked subaccounts are excluded. Unknown spot prices are excluded with a visible warning. USDC card shows spot cash only. Prices and account snapshots may have slightly different timestamps and are not executable quotes. BTC/HYPE market quotes refresh automatically every 15 seconds, including in demo mode. Portfolio balances and position marks remain a separate snapshot; refresh a connected portfolio manually. USDC $1 is a peg reference, not a live quote.

MVP1 is local, single-user software. Do not expose this development deployment publicly with a funded API key. Paid multi-user cloud hosting requires authentication, quotas, tenant isolation, durable storage and operational controls first. Local origin checks and in-memory request limits are not cloud authentication.


## Use alongside Hyperliquid in Chrome

Open the MVP and Hyperliquid in Chrome Split view. Right-click the **Hyperliquid** link in the app header and choose **Open link in split view**. If both tabs are already open, combine them using the tab context menu instead of opening duplicates. A normal click opens a new tab; web pages cannot force Chrome's native split layout.

Keep the pair open. Chrome's **Settings → On startup → Continue where you left off** restores the previous browsing session; the app does not modify this browser-wide preference. Start the microphone explicitly using **Start voice**.

[Chrome Split view instructions](https://support.google.com/chrome/answer/16971124?hl=en)

## DCA setup (stage 1)

Select **DCA setup** to discover EIP-6963 browser wallets (including MetaMask). Connect explicitly, then choose an installment amount in USDC, total order budget, BTC/HYPE allocation, cadence and first purchase time in UTC. Only spot plans are supported. Monthly schedules preserve the original day and clamp short months. Budgets include whole installments only; fees require additional funds.

**Save DCA draft** persists the plan in this browser, separately for each wallet address. Wallet/account/network changes invalidate the connection. These are configuration drafts, not running jobs: no signatures, API-agent permissions, exchange orders or cron workers are created. Voice currently controls simulation previews, not purchase drafts.

Next integration stage: durable container scheduling with budget reservations, idempotent order IDs, reconciliation and Start/Pause controls. Do not label a draft as running before that execution path exists.

## Manual spot purchase (stage 2)

After connecting a browser wallet in **DCA setup**, choose the amount/allocation and click **Prepare purchase**. The server reads verified UBTC/USDC and HYPE/USDC markets, fresh asks, account mode and available spot USDC. It rounds sizes/prices to exchange precision, reserves 1% within each allocation for fees, and blocks insufficient balances or allocations below the $10 minimum. The reserve is an estimate, not a quoted fee.

Review the 60-second quote, check the confirmation box, then click **Sign and buy once**. The wallet signs through the Hyperliquid SDK; the browser sends the signed IOC batch directly to the official mainnet exchange. Orders can fill partially or return independent errors. This action is separate from the saved schedule and does not consume its draft budget. BTC allocation purchases **UBTC (Unit Bitcoin)**.

A browser journal and per-wallet Web Lock prevent concurrent submissions and replay of the same quote. A timeout after dispatch is UNKNOWN and blocks further purchases; it is never automatically retried. Inspect the saved client order IDs in exchange history. Automated reconciliation and recovery are still pending. The journal is local to this browser and origin, not shared across devices. Clearing browser data removes this protection. No private key, API-agent permission, automatic purchase or scheduler is created.

Tests use mocked signing/network responses; no real wallet signatures or purchases are performed during validation.

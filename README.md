# DCA AI — Hyperliquid Copilot

[Public repository](https://github.com/Novals83/dca-ai)

Local-first portfolio intelligence and BTC + HYPE accumulation simulations. Manual, user-confirmed mainnet spot purchases through a local API agent are available in DCA setup. Recurring execution starts only after explicit confirmation; the dedicated agent key stays in a local Docker volume. The community edition is MIT licensed and free to self-host. OpenAI API use is billed separately to your own account.

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

Standard and unified Hyperliquid accounts are supported. Portfolio margin and legacy DEX abstraction are explicitly rejected. Unified equity uses spot balances once; per-DEX equity is not added. Vaults, staking, HIP-3 DEXs and linked subaccounts are excluded. Unknown spot prices are excluded with a visible warning. USDC card shows spot cash only. Prices and account snapshots may have slightly different timestamps and are not executable quotes. BTC/HYPE market quotes refresh automatically every 15 seconds, including in demo mode. Portfolio balances and position marks remain a separate snapshot; refresh a connected portfolio manually. USDC $1 is a peg reference, not a live quote.

MVP1 is local, single-user software. Do not expose this development deployment publicly with a funded API key. Paid multi-user cloud hosting requires authentication, quotas, tenant isolation, durable storage and operational controls first. Local origin checks and in-memory request limits are not cloud authentication.


## Use alongside Hyperliquid in Chrome

Open the MVP and Hyperliquid in Chrome Split view. Right-click the **Hyperliquid** link in the app header and choose **Open link in split view**. If both tabs are already open, combine them using the tab context menu instead of opening duplicates. A normal click opens a new tab; web pages cannot force Chrome's native split layout.

Keep the pair open. Chrome's **Settings → On startup → Continue where you left off** restores the previous browsing session; the app does not modify this browser-wide preference. Start the microphone explicitly using **Start voice**.

[Chrome Split view instructions](https://support.google.com/chrome/answer/16971124?hl=en)

## DCA setup (stage 1)

Select **DCA setup** to discover EIP-6963 browser wallets (including MetaMask). Connect explicitly, then choose an installment amount in USDC, total order budget, BTC/HYPE allocation, cadence and first purchase time in UTC. Only spot plans are supported. Monthly schedules preserve the original day and clamp short months. Budgets include whole installments only; fees require additional funds.

**Save DCA draft** persists the plan in this browser, separately for each wallet address. Wallet/account/network changes invalidate the connection. These are configuration drafts, not running jobs: no signatures, API-agent permissions, exchange orders or cron workers are created. Voice can create a separate DCA draft for review; it cannot start execution.

Use Scheduled DCA to start the reviewed plan on the server. Browser drafts remain separate from running strategies.

## Manual spot purchase (stage 2)

After connecting a browser wallet in **DCA setup**, choose the amount/allocation and click **Prepare purchase**. The server reads verified UBTC/USDC and HYPE/USDC markets, fresh asks, account mode and available spot USDC. It rounds sizes/prices to exchange precision, reserves 1% within each allocation for fees, and blocks insufficient balances or allocations below the $10 minimum. The reserve is an estimate, not a quoted fee.

Review the 60-second quote, check the confirmation box, then click **Confirm and buy via agent**. The server signs the stored quote through the Hyperliquid SDK using the approved local agent and sends the IOC batch to the official mainnet exchange. Orders can fill partially or return independent errors. This action is separate from the saved schedule and does not consume its draft budget. BTC allocation purchases **UBTC (Unit Bitcoin)**.

A browser journal and per-wallet Web Lock prevent concurrent submissions and replay of the same quote. A timeout after dispatch is UNKNOWN and blocks further purchases; it is never automatically retried. Inspect the saved client order IDs in exchange history. Automated reconciliation and recovery are still pending. The journal is local to this browser and origin, not shared across devices. Clearing browser data removes this protection. A separately approved local API agent is required. Confirming one purchase does not start a scheduler.

Tests use mocked signing/network responses; no real wallet signatures or purchases are performed during validation.

## Local API agent (stage 3)

In **DCA setup**, connect the master wallet, then **Prepare local agent**. This creates a dedicated key locally; it does not register permissions or start purchases. Review the public address and seven-day expiry, then explicitly select **Approve agent in wallet**. **Refresh authorization** reads `extraAgents` using the master address and verifies registration. Manual and explicitly started recurring execution use the approved agent.

Agent trading permission is broader than a DCA plan. Spot-only rules, budget limits and scheduling are application controls, not exchange-enforced restrictions on that key. Revocation is performed in Hyperliquid's API settings. A previously observed revoked agent or an expired agent is blocked; future rotation must create a fresh key, never reuse a pruned address.

The server stores keys in `/app/.agent-data` with file mode 0600 and returns only public metadata. Development uses the ignored source directory; production must mount a dedicated persistent volume:

```sh
docker run -d --name dca-ai-production --restart unless-stopped \
  -p 127.0.0.1:3101:3000 --env-file .env \
  -v dca-ai-agent-data:/app/.agent-data dca-ai:0.3.1
```

Do not delete the volume during container updates. Development and production have separate agent stores. This local single-user endpoint requires a matching loopback Origin and is not a multi-user authentication system. Keys are not encrypted at rest; protect the Docker host and its backups. Agent files are excluded from Git and Docker build context. No agent private key is returned to the browser, voice model or GitHub.

References: [Hyperliquid API wallets and nonce lifecycle](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets), [agent authorization](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint#approve-an-api-wallet).

### Unified accounts and spot purchases

Manual spot preparation supports standard and unified accounts. For unified accounts, purchasing power is capped by both unheld USDC and Hyperliquid's `tokenToAvailableAfterMaintenance` value. Missing availability blocks preparation; negative values yield zero buying power. This does not change the account mode or transfer collateral. Portfolio margin and legacy DEX abstraction remain unsupported. The portfolio view also supports unified accounts: shared collateral is counted once, while perpetual positions and exposure currently cover the main DEX only.

[Account abstraction modes](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/account-abstraction-modes)

### Agent execution and durable purchase journal

Production image: `dca-ai:0.4.0`, with the same `dca-ai-agent-data:/app/.agent-data` volume. Preparing a purchase stores its immutable quote in the volume. Confirmation submits only its ID and account; client-provided prices or quantities are never accepted for execution. The server rechecks authorization, expiry, available USDC and spot market identity before signing. Master account addresses are used for info queries; only the dedicated agent signs orders.

Execution results and a per-account lock live in the volume. Repeated requests for a recorded quote return its existing result without sending again. Unknown results block new purchases. **Refresh result** retrieves the server journal after browser/network interruptions; it does not resend or reconcile unknown exchange outcomes. A crash can leave a lock or pending result that requires operator reconciliation before recovery. Never delete these blindly. Automatic exchange reconciliation remains pending; recurring execution stops on ambiguous or incomplete results.

The execution endpoint requires a matching loopback Origin. This is local single-user software; it is not a multi-user authorization model. Keep the loopback-only port binding. Tests use ephemeral keys and mocked transports; no funded key is used for test signing.

## Scheduled DCA MVP

Production image: `dca-ai:0.5.0`. Keep the existing `dca-ai-agent-data:/app/.agent-data` volume. The production image enables `DCA_WORKER_ENABLED=1`; development keeps it disabled by default. Set it to `0` to disable background execution. The Node server starts a worker that checks persisted UTC schedules every 15 seconds; no open browser tab or Codex automation is needed. The computer and Docker container must remain running.

1. Connect the wallet and confirm the local agent is authorized.
2. Fill the amount, total budget, BTC/HYPE split, cadence and future UTC start time manually, or ask the voice/text Copilot for a real DCA draft. Include the budget and timezone. Select **Use draft in form** to import the proposed settings.
3. Review **Scheduled DCA**, set maximum slippage, check the authorization box and select **Start DCA strategy**. The server verifies the agent, account, balance and order sizes before saving a running strategy.
4. Follow its state, next slot, reserved budget and execution history. **Pause strategy** requests a stop before the next dispatch; already submitted orders may finish. **Resume saved strategy** retains the original settings and budget. To edit settings, pause and start a replacement after reviewing its new budget; the old strategy is archived.

There is one current strategy per account. The total number of slots is the whole-installment budget divided by installment amount. The worker reserves the full installment ceiling before preparation. Unused reserves, partial fills and failed slots do not fund extra automatic purchases. This conservative reservation is not actual spending; individual exchange results show fills. A replacement has a newly authorized budget; previous spending is not silently rolled into it.

Slots more than five minutes late are skipped rather than caught up. Month-end cadence remains anchored in UTC. Insufficient balance, expired/revoked agents, partial fills, rejections and ambiguous outcomes block further execution for review. Known completed journal records can be recovered without another submission. Crash locks and unknown exchange outcomes still require operator reconciliation; never clear them blindly. Failed strategies cannot be resumed while their outcome is uncertain.

The voice backend exposes a strict `create_dca_draft` tool with no trading or start capability. It asks for missing material inputs, returns a draft to the UI, and does not infer spending authorization from conversation. Fixed UI and text responses are English; voice responds in the language spoken.

## Strategy returns and server migration

**Strategy performance & accounting** shows actual invested USDC, fee-adjusted holdings, P&L, ROI, capital-time weighted APR and effective annualized XIRR. Annualized figures require at least 24 hours of complete history. Actual fills/fees and valuation snapshots are persisted; export them with **Export accounting JSON**. See [methodology, limitations and migration instructions](docs/ACCOUNTING.md).

The accounting layer supports local files or PostgreSQL/Supabase through `ACCOUNTING_STORAGE` and a server-only `DATABASE_URL`. Execution state and agent keys still live in the persistent Docker volume and must be transferred separately. Release image: `dca-ai:0.6.0`.

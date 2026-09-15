# Install DCA AI on macOS or Windows

This is the free, MIT-licensed local edition. An OpenAI API key is **optional**. No Node.js, Python, Supabase or exchange API key needs to be installed manually. Docker builds the application and its dependencies.

## Requirements

- Docker Desktop running. On Windows, use Linux containers with WSL 2 enabled; restart after installation if requested.
- A current Chrome browser with MetaMask or another compatible EVM wallet extension.
- Internet access for the initial build and live Hyperliquid data/trading. Local hosting does not mean offline trading.
- Git, or download and extract the repository ZIP instead.

## Download the complete MVP

The complete MVP currently lives on `codex/live-prices-voice`; `main` has not yet received the reviewed changes. Use this exact branch:

```sh
git clone --branch codex/live-prices-voice --single-branch https://github.com/Novals83/dca-ai.git
cd dca-ai
```

Without Git: download https://github.com/Novals83/dca-ai/archive/refs/heads/codex/live-prices-voice.zip and extract it. Do not copy another user's `.env`, browser storage or Docker volume. A new installation creates its own keys and starts with no running strategies.

## macOS installer

In Terminal, from the extracted repository directory:

```sh
bash install.command
```

Works with Apple Silicon and Intel Macs using Docker's native Node Linux image. The first build may take several minutes.

## Windows installer

In PowerShell, from the extracted repository directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

The execution-policy override applies only to that process; it does not change the machine policy. Review the script before running it.

## Open and configure

Open http://localhost:3101/app in Chrome, not an embedded browser without wallet extensions.

Without OpenAI, these features remain available: portfolio and live prices, simulation calculator, manual DCA forms, daily/weekly/monthly schedule and date list, wallet connection, agent authorization, confirmed spot purchases, container scheduling, performance accounting and JSON export. Free-form AI conversation and voice require OpenAI. The local chat fallback supports only limited commands. There is no separate month-grid calendar or OS calendar integration.

1. Select **DCA setup**, connect your own wallet, and enter amount, total budget, BTC allocation, cadence and first purchase time. The form's date/time is **UTC**.
2. Save/review the draft. A draft does not start trading.
3. In **Local API agent**, prepare the local agent if needed, then **Prepare replacement agent** to stage a fresh address for the full strategy duration. Review the new address and expiry, then choose **Authorize new agent in wallet**. Ethereum or Arbitrum can be selected in MetaMask; adding HyperEVM is unnecessary for this approval.
4. Confirm the signature yourself. The app verifies the exchange authorization before selecting the new signer. Do not reauthorize a used address; replacements use fresh keys. Remove unused older permissions in Hyperliquid API settings if you reach its agent limit.
5. Review and explicitly click **Start DCA strategy**. Check **RUNNING**, worker heartbeat and next slot. Spot buys use USDC for UBTC and HYPE without borrowing; minimum order sizes, available balances and fees still apply.

The machine must be awake with Docker running at the scheduled time. Closing the browser is fine. Missed slots older than five minutes are skipped, not bought in a catch-up burst. Partial or uncertain results block execution for review; never delete journals or locks to force retries. Approval permits trading more broadly than the plan; app limits are enforced by the local software. Approvals are limited to the supported 179-day window.

## Optional OpenAI chat and voice

Edit the generated `.env` locally and set `OPENAI_API_KEY` to your own OpenAI API project key. Keep it private. A ChatGPT subscription does not replace API access/billing. Leave the default model names unless your project requires a different available model; voice requires access to the configured voice model.

Apply changes:

```sh
docker compose -f compose.local.yaml up -d --force-recreate
```

Reload the page, click **Start voice**, and allow microphone access. Voice responds in the language spoken. Strategy questions send the selected account's portfolio, saved execution state and accounting context to OpenAI. Voice can propose drafts; actual activation remains a user-confirmed UI action. With an empty key, manual DCA remains fully usable.

## Routine operation

```sh
# Status and logs
docker compose -f compose.local.yaml ps
docker compose -f compose.local.yaml logs --tail 100 app
# Stop, keeping data
docker compose -f compose.local.yaml stop
# Restart
docker compose -f compose.local.yaml up -d
```

The named volume `dca-ai-local_agent-data` holds private agent keys, schedule state, purchase journals and accounting. Keep it private and backed up. Do not use `docker compose down -v` or Docker volume pruning on this installation. `.env` and data are excluded from Git and Docker build context.

For a port conflict, add `DCA_PORT=3102` to `.env`, rerun the installer, and open http://localhost:3102/app. Do not run two workers against a copied account's execution state. This local Compose file uses a separate volume from older developer installations; see [accounting and migration](ACCOUNTING.md) before moving an existing funded strategy.

For updates: pause the strategy in the UI, wait for any submitted purchase to resolve, pull the same branch and rerun the installer. Verify status, then resume explicitly. Never overwrite `.env` or remove the volume.

## Instructions for another Codex agent

Read [CODEX_SETUP.md](CODEX_SETUP.md) and the repository's `AGENTS.md`. Install and verify locally; leave wallet signatures and trading activation to the user.

## Validation scope

The production Compose deployment is tested locally with a fresh isolated volume, empty OpenAI key and HTTP health checks. Core scheduling and signing are covered by mocked-exchange tests. Windows PowerShell is supplied for Docker Desktop/WSL 2 but has not been executed on a Windows host in this repository's local validation. Do not describe Windows deployment as independently verified until tested there.

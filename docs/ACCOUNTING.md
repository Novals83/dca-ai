# Accounting and migration

## What is measured

Each confirmed exchange fill is stored once using order ID, trade ID and transaction hash. Only app-owned order IDs are attributed. Planned amounts and reserved budgets are never treated as investments. Actual fill timestamps, prices, quantities and fee tokens are retained. USDC fees increase cash cost; base-asset fees reduce acquired quantity. Unknown fee assets or missing fills make performance incomplete rather than assuming zero fees.

The strategy book assumes buy-and-hold attribution. External sales, transfers and unrelated wallet positions are excluded; this is not a complete wallet cash-flow statement. Marked value uses current verified spot pair mids and excludes hypothetical exit fees. DCA replacements created from this release retain a series ID; older unlinked histories are not silently merged. Manual purchases have their own scope. An aggregate view covers all app purchases.

- P&L = marked net holdings minus actual invested USDC.
- ROI = P&L / invested USDC.
- Capital-time weighted APR = P&L / sum(investment × years invested), with a 365-day year. This is a simple annualized measure, not a promised rate.
- XIRR solves sum(investment × (1+r)^years invested) = current marked value. This is an effective annualized money-weighted return, not simple APR.
- Annualization is withheld for less than 24 hours of history, incomplete data, or an unsolved root. Very short histories remain highly sensitive to price changes.

[Microsoft XIRR reference](https://support.microsoft.com/en-us/excel/functions/xirr-function)

## Persistence

Production refreshes accounting every five minutes and on **Refresh performance**. Immutable fill events, valuation snapshots, public execution records and strategy revisions are stored in `/app/.agent-data/accounting` by default. Snapshots are limited to one per minute. Missing exchange history is reported, not fabricated; data must be captured before upstream retention limits remove it. **Export accounting JSON** exports saved accounting data, without private keys.

`AccountingRepository` separates analytics persistence from calculations. Two adapters are included:

- `ACCOUNTING_STORAGE=file` (default): local append-only files in the persistent volume.
- `ACCOUNTING_STORAGE=postgres`, `DATABASE_URL=...`: server-side PostgreSQL, including Supabase. The database URL must never use a `NEXT_PUBLIC_` prefix. Supply your provider's required TLS configuration in the connection URL; certificate verification is not disabled by the application.

Apply `supabase/migrations/202609120001_accounting.sql` before enabling PostgreSQL. RLS is enabled with no anonymous browser policies. Use a trusted server database role. Never place agent keys in this table.

## Moving to a server

1. Pause all strategies and wait for any in-flight order to reach a known result. Stop the old container. Do not run two trading workers against the same agents.
2. Back up and transfer the **entire** `dca-ai-agent-data` volume through a secure channel. It contains keys, execution locks/journals, strategy state and accounting. Preserve ownership (container UID 1000) and permissions. Unknown results and locks require reconciliation; do not delete them to start the worker.
3. Restore the volume on the destination, configure `.env`, and initially run with `DCA_WORKER_ENABLED=0`.
4. Optional PostgreSQL/Supabase: set `DATABASE_URL` server-side and import the accounting files. For a migration container with the source volume mounted:

```sh
docker build --target dev -t dca-ai:migration .
docker run --rm --env-file .env -v dca-ai-agent-data:/app/.agent-data \
  dca-ai:migration node scripts/migrate-accounting.mjs
```

The importer applies the SQL schema and inserts data idempotently in a transaction. Source files are retained. Compare exported records/counts before changing `ACCOUNTING_STORAGE=postgres`. The importer must connect using a role allowed to create the schema.

5. Check agent authorization, balances, schedule status and journal integrity. Enable one worker and explicitly resume strategies. Expired agents require fresh keys and authorization.

**Scope:** PostgreSQL currently stores the accounting layer, not the execution coordinator. Agent keys, strategy control and idempotency locks still require the persistent volume. A database URL alone does not migrate the whole application or make multiple workers safe. Public/cloud multi-user hosting still requires authentication, tenant authorization and secret management. Keep loopback binding or use a private authenticated tunnel for this single-user MVP.

[Supabase PostgreSQL connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres) · [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations)

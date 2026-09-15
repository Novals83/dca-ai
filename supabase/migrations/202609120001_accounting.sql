-- Server-side accounting storage. Compatible with PostgreSQL and Supabase.
create table if not exists public.dca_accounting (
 account text not null check (account ~ '^0x[0-9a-f]{40}$'),
 kind text not null check (kind in ('fills','snapshots','records','strategies')),
 id text not null,
 data jsonb not null,
 created_at timestamptz not null default now(),
 primary key(account,kind,id)
);
alter table public.dca_accounting enable row level security;
-- No browser policies. Access only via a trusted server database role.
create index if not exists dca_accounting_history on public.dca_accounting(account,kind,created_at);

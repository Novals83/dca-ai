# Codex handoff: deploy the local DCA AI MVP

Follow [INSTALL.md](INSTALL.md). Use branch `codex/live-prices-voice`, not the bootstrap `main` branch. Read `AGENTS.md` before work; all application content and documentation are English.

1. Check Docker Desktop and Compose. If missing, help the user install/start Docker; use Linux containers on Windows. Clone or extract the public source into a new directory.
2. Run `bash install.command` on macOS or `powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1` on Windows. Existing `.env` is retained. An empty OpenAI key is a valid installation, not a blocker.
3. Check `docker compose -f compose.local.yaml ps`, HTTP `/app` and `/api/status`. Verify the worker using a read-only POST to `/api/dca` with the user's public account, action `status`, and the same localhost Origin. A fresh account should have no strategy.
4. Open `/app` in Chrome with the user's wallet extension. Explain the manual plan, UTC first date, agent preparation, signature and explicit Start DCA strategy controls.
5. Do not request seed phrases or the master wallet private key. Do not copy credentials from another installation. Do not sign, trade, activate funded strategies or click purchase buttons to validate the installer. Test such code only with isolated storage and mocked exchange transports.
6. Ask about OpenAI only as an optional enhancement after core installation works. Have the user enter the API key locally in `.env`; never print it. Recreate the container after changes. Explain that enabling AI transmits account context to OpenAI.
7. Report the local URL, container health, data volume and any remaining platform/model-access limitation. Keep application data on this machine; do not upload it to GitHub.

This is a single-user localhost deployment, not a public SaaS server. Do not bind it to a public interface or add a tunnel. A cloud migration requires authentication, tenant isolation and a deliberate key-custody design. PostgreSQL/Supabase accounting support does not replace the private execution volume.

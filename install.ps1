$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Install Docker Desktop with Linux containers (WSL 2), open it, then retry.' }
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop and wait for its engine, then retry.' }
docker compose version
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose is required.' }
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }
Write-Host 'Building DCA AI. OpenAI is optional; an empty key is supported.'
docker compose -f compose.local.yaml up -d --build --wait --wait-timeout 180
if ($LASTEXITCODE -ne 0) { throw 'Startup failed. Read the Docker error above. Existing data has been retained.' }
Write-Host 'Ready: http://localhost:3101/app (or the DCA_PORT configured in .env).'
Write-Host 'Keep the Docker data volume. Never use down -v unless intentionally deleting all data.'

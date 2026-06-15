# ============================================================================
# DynaDemoCap · Arranque del entorno (Windows)  — R-ENV-01..07
# Paridad con start.sh: valida variables, dependencias y puertos antes de
# levantar SIM, PER y FE.
# ============================================================================
#Requires -Version 5
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Log($msg)  { Write-Host "[start.ps1] $msg" }
function Fail($msg) { Write-Host "[start.ps1][ERROR] $msg" -ForegroundColor Red; exit 1 }

# --- Cargar .env -----------------------------------------------------------
$envFile = Join-Path $Root '.env'
if (-not (Test-Path $envFile)) { Fail "No existe .env (copia .env.example a .env)" }
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
    $idx = $line.IndexOf('=')
    $k = $line.Substring(0, $idx).Trim()
    $v = $line.Substring($idx + 1).Trim().Trim('"')
    Set-Item -Path "Env:$k" -Value $v
  }
}

# --- 1. Validar variables de entorno obligatorias (R-ENV-01, R-ENV-02) -----
Log "Validando variables de entorno..."
$required = 'EXCHANGERATE_API_KEY','EXCHANGERATE_BASE_URL','SIM_PORT','PERSIST_PORT','FRONTEND_PORT'
foreach ($v in $required) {
  $val = [Environment]::GetEnvironmentVariable($v)
  if ([string]::IsNullOrWhiteSpace($val)) { Fail "Falta variable de entorno: $v" }
}

# --- 2. Validar dependencias (R-ENV-05) ------------------------------------
Log "Validando dependencias..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js no está instalado" }
if (-not (Get-Command npm  -ErrorAction SilentlyContinue)) { Fail "npm no está instalado" }

if (-not (Test-Path (Join-Path $Root 'frontend/node_modules'))) {
  Log "Instalando dependencias del frontend (npm install)..."
  Push-Location (Join-Path $Root 'frontend')
  npm install
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { Fail "npm install falló en frontend" }
}

# --- 3. Validar puertos libres (R-ENV-03, R-ENV-04) ------------------------
function Test-PortFree($port) {
  node -e "const net=require('net');const s=net.createServer();s.once('error',()=>process.exit(1));s.listen($port,()=>s.close(()=>process.exit(0)));"
  return ($LASTEXITCODE -eq 0)
}
Log "Validando puertos..."
foreach ($pair in @(@('SIM_PORT', $env:SIM_PORT), @('PERSIST_PORT', $env:PERSIST_PORT), @('FRONTEND_PORT', $env:FRONTEND_PORT))) {
  if (-not (Test-PortFree $pair[1])) { Fail ("Puerto ocupado ({0}={1})" -f $pair[0], $pair[1]) }
}

# --- 4. Seed de tasas: UNA sola llamada -> snapshot JSON (R-SIM-01) ---------
Log "Generando snapshot de tasas (seed, una sola vez)..."
node services/simulator/seed.js
if ($LASTEXITCODE -ne 0) { Fail "El seed de tasas falló" }

# --- 5. Levantar servicios en orden SIM -> PER -> FE (R-ENV-06) -------------
$env:VITE_SIM_URL = "http://localhost:$($env:SIM_PORT)"
$env:VITE_PER_URL = "http://localhost:$($env:PERSIST_PORT)"

Log "Iniciando SIM (simulador/caché) en :$($env:SIM_PORT)..."
$sim = Start-Process node -ArgumentList 'services/simulator/server.js' -NoNewWindow -PassThru

Log "Iniciando PER (persistencia) en :$($env:PERSIST_PORT)..."
$per = Start-Process node -ArgumentList 'services/persistence/server.js' -NoNewWindow -PassThru

Log "Iniciando FE (mockup Vue) en :$($env:FRONTEND_PORT)... (Ctrl+C para detener todo)"
Push-Location (Join-Path $Root 'frontend')
try {
  npm run dev
}
finally {
  Pop-Location
  Log "Deteniendo servicios..."
  if ($sim -and -not $sim.HasExited) { Stop-Process -Id $sim.Id -Force -ErrorAction SilentlyContinue }
  if ($per -and -not $per.HasExited) { Stop-Process -Id $per.Id -Force -ErrorAction SilentlyContinue }
}

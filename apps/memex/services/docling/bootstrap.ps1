#!/usr/bin/env pwsh
# Create .venv + install docling. Idempotent.
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$venv = Join-Path $here ".venv"
$python = Join-Path $venv "Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "Creating venv at $venv"
    python -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw "venv creation failed" }
}

Write-Host "Upgrading pip"
& $python -m pip install --upgrade pip

Write-Host "Installing requirements"
& $python -m pip install -r (Join-Path $here "requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "pip install failed" }

Write-Host "Done. Verify: & '$python' process.py <pdf>"

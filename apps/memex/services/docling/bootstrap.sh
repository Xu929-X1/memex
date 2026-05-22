#!/usr/bin/env bash
# Create .venv + install docling. Idempotent.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$here"

venv="$here/.venv"
python_bin="$venv/bin/python"

if [ ! -x "$python_bin" ]; then
    echo "Creating venv at $venv"
    python3 -m venv "$venv"
fi

echo "Upgrading pip"
"$python_bin" -m pip install --upgrade pip

echo "Installing requirements"
"$python_bin" -m pip install -r "$here/requirements.txt"

echo "Done. Verify: $python_bin process.py <pdf>"

#!/usr/bin/env bash
# Rebuild rift.json from game data pulled direct from Goodgame Studios. Needs curl + python3.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/../../_srcdata/pull.sh"
python3 "$here/extract.py" "$here/../../_srcdata/cache/ggs.dll.latest.js"
echo "Done."

#!/usr/bin/env bash
# Rebuild hol.json from the community game-data cache. Needs python3.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
python3 "$here/extract.py"
echo "Done."

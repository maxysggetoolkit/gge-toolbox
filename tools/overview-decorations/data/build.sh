#!/usr/bin/env bash
# Rebuild decorations.json from game data pulled direct from Goodgame Studios. Needs curl + jq + python3.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/../../_srcdata/pull.sh"
cache="$here/../../_srcdata/cache"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
jq -c 'with_entries(.key|=ascii_downcase)' "$cache/en.json" > "$tmp/en.json"
jq --slurpfile lang "$tmp/en.json" -f "$here/extract.jq" "$cache/items_latest.json" > "$here/decorations.json"
python3 "$here/add_images.py" "$cache/ggs.dll.latest.js" "$here/decorations.json"
echo "Wrote decorations.json — $(jq '.items|length' "$here/decorations.json") decorations."

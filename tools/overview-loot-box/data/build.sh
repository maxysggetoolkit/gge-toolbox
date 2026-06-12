#!/usr/bin/env bash
# Rebuild loot-boxes.json from game data pulled direct from Goodgame Studios. Needs curl + jq + python3.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/../../_srcdata/pull.sh"
cache="$here/../../_srcdata/cache"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
jq -c 'with_entries(.key|=ascii_downcase)' "$cache/en.json" > "$tmp/en.json"
jq --slurpfile lang "$tmp/en.json" -f "$here/extract.jq" "$cache/items_latest.json" > "$here/loot-boxes.json"
python3 "$here/add_images.py" "$cache/ggs.dll.latest.js" "$here/loot-boxes.json"
echo "Wrote loot-boxes.json — $(jq '.boxes|length' "$here/loot-boxes.json") boxes."

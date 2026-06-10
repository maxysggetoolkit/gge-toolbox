#!/usr/bin/env bash
# Rebuild construction-items.json from the community game-data cache. Needs curl + jq.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
base="https://raw.githubusercontent.com/GeneralsCamp/ggempire-data-cache/main/public/data"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
curl -sL "$base/lang/en.json" | jq -c 'with_entries(.key|=ascii_downcase)' > "$tmp/en.json"
curl -sL "$base/empire/items_latest.json" -o "$tmp/items.json"
jq --slurpfile lang "$tmp/en.json" -f "$here/extract.jq" "$tmp/items.json" > "$here/construction-items.json"
echo "Wrote construction-items.json — $(jq '.items|length' "$here/construction-items.json") construction items."

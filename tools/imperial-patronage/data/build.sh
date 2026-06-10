#!/usr/bin/env bash
# Rebuild patronage.json from the live GeneralsCamp data cache.
set -euo pipefail
cd "$(dirname "$0")"
BASE="https://raw.githubusercontent.com/GeneralsCamp/ggempire-data-cache/main/public/data"

tmp="$(mktemp -d)"
curl -sL "$BASE/empire/items_latest.json"        -o "$tmp/items.json"
curl -sL "$BASE/lang/en.json"                     -o "$tmp/en.json"
curl -sL "$BASE/empire/dll/ggs.dll.latest.js"     -o "$tmp/ggs.dll.js"

python3 extract.py "$tmp/items.json" "$tmp/en.json" "$tmp/ggs.dll.js" > patronage.json
echo "patronage.json: $(wc -c < patronage.json) bytes"
rm -rf "$tmp"

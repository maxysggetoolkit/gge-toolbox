#!/usr/bin/env bash
# Rebuild gacha data for every cached game version.
# Produces gacha-<version>.json (one per version) + versions.json manifest.
# Needs: curl, jq.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
base="https://raw.githubusercontent.com/GeneralsCamp/ggempire-data-cache/main/public/data"

# game-version item files in the cache, newest last
FILES=(items_766_02 items_770_07 items_772_01 items_774_01 items_775_01)

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading + lowercasing language file…"
curl -sL "$base/lang/en.json" | jq -c 'with_entries(.key|=ascii_downcase)' > "$tmp/en_lower.json"

manifest="[]"
for f in "${FILES[@]}"; do
  ver="$(echo "$f" | sed -E 's/items_([0-9]+)_([0-9]+)/\1.\2/')"
  echo "→ version $ver"
  curl -sL "$base/empire/items/$f.json" -o "$tmp/items.json"
  jq --slurpfile lang "$tmp/en_lower.json" -f "$here/extract_gacha.jq" "$tmp/items.json" \
     > "$here/gacha-$ver.json"
  manifest="$(jq -c --arg v "$ver" '. + [$v]' <<<"$manifest")"
done

# versions.json: newest first; last entry is "latest"
latest="$(jq -r '.[-1]' <<<"$manifest")"
jq -n --argjson list "$manifest" --arg latest "$latest" \
  '{latest:$latest, versions:($list|reverse)}' > "$here/versions.json"

echo "Done. Versions: $(jq -r '.versions|join(", ")' "$here/versions.json")  (latest $latest)"

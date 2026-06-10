# Chemie's VIP Corner — encrypted

The pages in this folder (`index.html`, `wall-break.html`, …) are **AES-256-GCM
encrypted** (PBKDF2-SHA256, 600k iterations) and decrypted in the browser with the
access code. What's committed here is ciphertext — the tools can't be read from the
repo or via a direct link without the code, and the code is never stored anywhere.

## Editing a VIP tool

1. Edit the **plaintext** source in [`_src/`](./_src) — this folder is gitignored and
   stays on your machine only. (Keep a backup; it's the only readable copy.)
2. Re-encrypt:
   ```sh
   python3 tools/vip/encrypt.py "YOUR-ACCESS-CODE"
   ```
   (or `export VIP_PASS=…` and run with no argument)
3. Commit the regenerated `tools/vip/*.html`. Leave `_src/` uncommitted.

## Changing the access code

Just run `encrypt.py` with a new code — every page is re-encrypted with a fresh salt.
Then share the new code with members (via the Discord bot, once it's live).

## Notes

- `vip.css` and `vip-shared.js` stay plaintext on purpose — they're shared support
  files (styling + the public-API client), not the gated content.
- Requires a secure context (https or localhost) for WebCrypto — both GitHub Pages
  and the local preview server qualify.
- One correct unlock is remembered for the browser session (sessionStorage), so
  moving between VIP pages doesn't re-prompt; closing the tab re-locks.

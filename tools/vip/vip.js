/* Chemie's VIP Corner — lightweight client-side access gate.

   NOTE: this is obfuscation, not real security. The code's SHA-256 hash lives
   below; anyone determined can still read the page source. It keeps the casual
   visitor out, which is all a client-only site can do. For genuinely private
   data, the tools inside would need a server with real auth.

   To change the access code: run in any terminal —
     printf 'YOURCODE' | shasum -a 256
   and paste the hash into CODE_HASH below. Codes are compared upper-cased.
   Current code: REDACTED-VIP-CODE
*/
(function () {
  "use strict";

  const CODE_HASH = "8d9ce1d2ba219e333cb5d5c0afa47847a16168793c27d52ed55723241d8ce0bc";
  const STORE_KEY = "vip_unlocked_v1";

  const body = document.body;
  const form = document.getElementById("vip-form");
  const input = document.getElementById("vip-code");
  const err = document.getElementById("vip-err");
  const lockBtn = document.getElementById("vip-lock");

  function setLocked(locked) {
    body.classList.toggle("vip-locked", locked);
    body.classList.toggle("vip-unlocked", !locked);
  }

  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Start locked unless previously unlocked on this device.
  setLocked(localStorage.getItem(STORE_KEY) !== "1");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    const code = (input.value || "").trim().toUpperCase();
    if (!code) return;
    const hash = await sha256Hex(code);
    if (hash === CODE_HASH) {
      localStorage.setItem(STORE_KEY, "1");
      setLocked(false);
      input.value = "";
    } else {
      err.textContent = "Wrong code — ask Chemie for access.";
      input.select();
    }
  });

  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      localStorage.removeItem(STORE_KEY);
      setLocked(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
})();

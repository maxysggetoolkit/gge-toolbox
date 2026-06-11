/* Shared sync engine for the VIP leader tools (Rift Leaders + Account Registry).
   Real-time shared state via JSONBin.io, exactly like Maxy's standalone rift
   tracker. Contains NO secrets — the JSONBin master key + Anthropic key are
   entered by each leader at runtime and live only in their own localStorage.

   Config (localStorage "vip_track_cfg"):
     jsonbinKey   — JSONBin master key ($2a$…), one per JSONBin account
     riftBinId    — bin holding the rift roster (can be the same bin Maxy's
                    standalone tracker already uses, so data is shared)
     accountsBinId— bin holding the Alchemists account registry
     anthropic    — Anthropic API key (only the rift page uses it, for screenshots)
*/
(function () {
  "use strict";

  const LS = "vip_track_cfg";
  // Shared team credentials may be baked into the (encrypted) page as
  // window.VIP_SHARED — anyone who unlocks the VIP corner syncs with zero
  // setup. A leader's own Config entries (localStorage) override them.
  const shared = window.VIP_SHARED || {};
  const cfg = { jsonbinKey: "", riftBinId: "", accountsBinId: "", anthropic: "", acctKey: "" };
  let own = {};
  try { own = JSON.parse(localStorage.getItem(LS) || "{}"); } catch (e) {}
  Object.keys(cfg).forEach((k) => { cfg[k] = own[k] || shared[k] || ""; });
  function saveCfg(patch) {
    Object.keys(patch).forEach((k) => { own[k] = patch[k]; cfg[k] = patch[k] || shared[k] || ""; });
    localStorage.setItem(LS, JSON.stringify(own));
  }

  // ---- JSONBin REST (whole-record get/put) ----
  async function binGet(binId) {
    const r = await fetch("https://api.jsonbin.io/v3/b/" + binId + "/latest", { headers: { "X-Master-Key": cfg.jsonbinKey } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return (await r.json()).record || {};
  }
  async function binPut(binId, record) {
    const r = await fetch("https://api.jsonbin.io/v3/b/" + binId, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Master-Key": cfg.jsonbinKey },
      body: JSON.stringify(record),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return true;
  }

  // ---- client-side payload encryption (AES-256-GCM) ----
  // The account registry is encrypted before it ever reaches JSONBin, with a
  // dedicated 32-byte key baked into the (encrypted) VIP page as
  // window.VIP_SHARED.acctKey. So even though the bin is a public JSONBin store,
  // the roster is only ever ciphertext at rest — confidentiality reduces to the
  // VIP code, not JSONBin's privacy toggle or the master key's scope.
  let _ckPromise = null;
  function acctKeyMaterial() {
    if (_ckPromise) return _ckPromise;
    _ckPromise = (async () => {
      const b64 = cfg.acctKey || "";
      if (!b64) return null;
      let raw;
      try { raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); } catch (e) { return null; }
      if (raw.length !== 32) raw = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
      return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    })();
    return _ckPromise;
  }
  function hasAcctKey() { return !!cfg.acctKey; }
  const _b64 = (u) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  async function encryptJSON(obj) {
    const key = await acctKeyMaterial();
    if (!key) throw new Error("no registry key");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
    const out = new Uint8Array(iv.length + ct.length); out.set(iv); out.set(ct, iv.length);
    return _b64(out);
  }
  async function decryptJSON(b64) {
    const key = await acctKeyMaterial();
    if (!key) throw new Error("no registry key");
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, 12) }, key, data.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  // ---- helpers ----
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
  const escAttr = (s) => String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const PAL = [["#3b2f12","#f7cd72"],["#12301f","#7fd9a6"],["#321616","#f0a6a6"],["#1c2540","#9fc0f0"],["#2a1430","#d7a6e8"],["#0c2530","#86d6ec"]];
  function avatar(n) { return PAL[(n.charCodeAt(0) || 0) % PAL.length]; }
  function initials(n) { return n.split(/[\s._]+/).map((w) => w[0] || "").join("").toUpperCase().slice(0, 2) || n.slice(0, 2).toUpperCase(); }
  function parseTime(s) { if (!s) return null; s = String(s).trim(); let m = s.match(/^(\d+):(\d{2})$/); if (m) return +m[1] * 60 + +m[2]; let n = s.match(/^(\d+(?:\.\d+)?)$/); if (n) return Math.round(parseFloat(n[1]) * 60); return null; }
  function fmtTime(s) { if (s == null) return ""; return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }

  // ---- toast ----
  let toastT;
  function toast(msg) {
    let el = document.getElementById("vipToast");
    if (!el) { el = document.createElement("div"); el.id = "vipToast"; el.className = "vt-toast"; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // ---- sync status dot (expects #vtSyncDot / #vtSyncMsg in the page header) ----
  function setSync(state, msg) {
    const d = document.getElementById("vtSyncDot"), m = document.getElementById("vtSyncMsg");
    if (d) d.className = "vt-dot" + (state === "syncing" ? " syncing" : state === "error" ? " error" : state === "off" ? " off" : "");
    if (m) m.textContent = msg;
  }

  // ---- shared config banner (one set of keys serves both pages) ----
  function mountConfig(host, onSaved) {
    host.innerHTML =
      '<h2>⚙️ Leader setup — shared sync</h2>' +
      '<p>Keys are saved <b>in your browser only</b> and never leave it except to call JSONBin / Anthropic directly. ' +
      'Other leaders just open the page and paste the same <b>JSONBin master key + bin IDs</b> to share live data. ' +
      'No account passwords are ever stored anywhere.</p>' +
      '<div class="vt-cfg-row"><input id="cfgKey" type="password" autocomplete="off" placeholder="JSONBin master key ($2a$…)"></div>' +
      '<div class="vt-cfg-row">' +
        '<input id="cfgRift" type="text" autocomplete="off" placeholder="Rift roster bin ID">' +
        '<input id="cfgAcc" type="text" autocomplete="off" placeholder="Account registry bin ID">' +
      '</div>' +
      '<div class="vt-cfg-row"><input id="cfgAnth" type="password" autocomplete="off" placeholder="Anthropic API key (sk-ant-… — only for rift screenshot parsing)"></div>' +
      '<div class="vt-cfg-row"><button class="vip-btn" id="cfgSave">Save &amp; connect</button>' +
      '<button class="vip-btn ghost" id="cfgClose">Close</button></div>' +
      '<p class="vt-hint">Free shared store: <a href="https://jsonbin.io" target="_blank" rel="noopener">jsonbin.io</a> — make a bin containing <code>{}</code>, copy its Bin ID + your Master Key. ' +
      'Use <b>two</b> bins (one for the rift roster, one for accounts). Anthropic key (optional): <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>.</p>';
    host.querySelector("#cfgKey").value = cfg.jsonbinKey || "";
    host.querySelector("#cfgRift").value = cfg.riftBinId || "";
    host.querySelector("#cfgAcc").value = cfg.accountsBinId || "";
    host.querySelector("#cfgAnth").value = cfg.anthropic || "";
    host.querySelector("#cfgClose").onclick = () => { host.style.display = "none"; };
    host.querySelector("#cfgSave").onclick = () => {
      saveCfg({
        jsonbinKey: host.querySelector("#cfgKey").value.trim(),
        riftBinId: host.querySelector("#cfgRift").value.trim(),
        accountsBinId: host.querySelector("#cfgAcc").value.trim(),
        anthropic: host.querySelector("#cfgAnth").value.trim(),
      });
      host.style.display = "none";
      toast("Config saved");
      if (onSaved) onSaved();
    };
  }

  // ---- inject shared styles once ----
  if (!document.getElementById("vtStyles")) {
    const s = document.createElement("style"); s.id = "vtStyles";
    s.textContent = `
    .vt-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(8px);background:var(--gold);color:#1a1206;padding:9px 20px;border-radius:999px;font-size:.82rem;font-weight:600;pointer-events:none;opacity:0;transition:.2s;z-index:999;white-space:nowrap;}
    .vt-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
    .vt-sync{display:flex;align-items:center;gap:7px;font-size:.8rem;color:var(--text-faint);margin:2px 0 14px;}
    .vt-dot{width:8px;height:8px;border-radius:50%;background:var(--good);display:inline-block;flex-shrink:0;}
    .vt-dot.syncing{background:var(--gold);animation:vtpulse 1s infinite;}
    .vt-dot.error{background:var(--bad);} .vt-dot.off{background:var(--text-faint);}
    @keyframes vtpulse{0%,100%{opacity:1}50%{opacity:.3}}
    .vt-cfg{background:var(--bg-elev);border:1px solid var(--gold-dim);border-radius:var(--radius);padding:16px 18px;margin-bottom:18px;}
    .vt-cfg h2{font-size:.95rem;color:var(--gold);margin:0 0 8px;}
    .vt-cfg p{font-size:.8rem;color:var(--text-dim);margin:0 0 10px;line-height:1.55;}
    .vt-cfg-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
    .vt-cfg-row input{flex:1;min-width:200px;font:inherit;font-size:.82rem;padding:8px 10px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-elev-2);color:var(--text);}
    .vt-cfg-row input:focus{outline:none;border-color:var(--gold);}
    .vt-hint{font-size:.74rem;color:var(--text-faint);} .vt-hint a{color:var(--gold-dim);}
    .vt-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:18px;}
    .vt-stat{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius-sm);padding:11px 13px;}
    .vt-stat .l{font-size:.72rem;color:var(--text-faint);margin-bottom:3px;}
    .vt-stat .v{font-size:1.5rem;font-weight:700;color:var(--text);line-height:1;}
    .vt-tabs{display:flex;gap:4px;background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px;margin-bottom:14px;flex-wrap:wrap;}
    .vt-tab{flex:1;min-width:90px;padding:7px 12px;border-radius:6px;border:none;background:transparent;color:var(--text-dim);font:inherit;font-size:.84rem;cursor:pointer;}
    .vt-tab.active{background:var(--gold);color:#1a1206;font-weight:600;}
    .vt-list{border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;}
    .vt-row{display:flex;align-items:center;gap:10px;padding:9px 13px;border-bottom:1px solid var(--border);flex-wrap:wrap;}
    .vt-row:last-child{border-bottom:none;} .vt-row:hover{background:rgba(217,178,90,.03);}
    .vt-av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0;}
    .vt-nm{flex:1;min-width:120px;font-size:.88rem;color:var(--text);font-weight:600;display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
    .vt-acts{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
    .vt-chip{display:inline-flex;align-items:center;gap:3px;font-size:.7rem;padding:2px 9px;border-radius:999px;font-weight:600;white-space:nowrap;border:1px solid transparent;}
    .vt-chip.green{background:rgba(127,217,166,.12);color:var(--good);border-color:rgba(127,217,166,.25);}
    .vt-chip.gold{background:rgba(217,178,90,.14);color:var(--gold);border-color:rgba(217,178,90,.3);}
    .vt-chip.red{background:rgba(240,166,166,.12);color:var(--bad);border-color:rgba(240,166,166,.25);}
    .vt-chip.dim{background:var(--bg-elev-2);color:var(--text-dim);border-color:var(--border);}
    .vt-mini{font:inherit;font-size:.76rem;padding:4px 9px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-elev-2);color:var(--text-dim);cursor:pointer;}
    .vt-mini:hover{color:var(--text);border-color:var(--gold-dim);}
    .vt-mini.danger{color:var(--bad);} .vt-mini.on{background:var(--gold);color:#1a1206;border-color:var(--gold);font-weight:600;}
    .vt-time{width:62px;font:inherit;font-size:.76rem;padding:4px 6px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-elev-2);color:var(--text);text-align:center;font-variant-numeric:tabular-nums;}
    .vt-time:focus{outline:none;border-color:var(--gold);}
    .vt-sel{font:inherit;font-size:.76rem;padding:4px 7px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-elev-2);color:var(--text);cursor:pointer;}
    .vt-sel:focus{outline:none;border-color:var(--gold);}
    .vt-form{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius);padding:13px;margin-bottom:14px;}
    .vt-form .r{display:flex;gap:8px;flex-wrap:wrap;}
    .vt-form input,.vt-form select{font:inherit;font-size:.82rem;padding:7px 10px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-elev-2);color:var(--text);}
    .vt-empty{text-align:center;padding:34px 16px;color:var(--text-faint);font-size:.85rem;}
    .vt-note{font-size:.78rem;color:var(--text-faint);border-left:3px solid var(--gold-dim);padding:8px 14px;background:rgba(217,178,90,.05);border-radius:var(--radius-sm);margin-bottom:14px;line-height:1.5;}
    `;
    document.head.appendChild(s);
  }

  window.VIPTrack = { cfg, saveCfg, binGet, binPut, encryptJSON, decryptJSON, hasAcctKey, mountConfig, toast, setSync, esc, escAttr, avatar, initials, parseTime, fmtTime };
})();

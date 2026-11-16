/**
 * Antigravity Theme Studio — In-App Live Customizer (Shadow DOM isolated).
 * Injected on demand by patch/pixelTheme.js; communicates with Electron main process
 * via console bridge ("__KN_STUDIO__") + window.__knStudioReceive.
 */
(() => {
  "use strict";
  if (window.top !== window.self) return "not-top";
  const HOST_ID = "kn-studio-host";
  if (document.getElementById(HOST_ID) || window.__knStudio) return "already-present";

  const AUTOSAVE_STORAGE_KEY = "kn-studio-autosave";
  const MAX_DROP_FILE_BYTES = 15 * 1024 * 1024;
  const MAX_DATA_URL_CHARS = 22 * 1024 * 1024;
  const ALLOWED_IMAGE_EXT_RE = /\.(png|jpe?g|webp|avif|gif|bmp|svg|ico)$/i;

  const PRESET_SWATCHES = {
    "kanagawa-wave": { label: "Kanagawa Wave", colors: ["#131720", "#E6C384", "#7AA89F", "#7E9CD8", "#D27E99"] },
    "kanagawa-dragon": { label: "Kanagawa Dragon", colors: ["#151412", "#C4B28A", "#8EA4A2", "#8BA4B0", "#C4746E"] },
    "sakura-dusk": { label: "Sakura Dusk", colors: ["#171421", "#E6A9BD", "#9CD5C9", "#A3B8EF", "#D27E99"] },
    "midnight-aqua": { label: "Midnight Aqua", colors: ["#0D1520", "#73DACA", "#7DCFFF", "#7AA2F7", "#F7768E"] },
    "tokyo-night": { label: "Tokyo Night", colors: ["#16161E", "#7AA2F7", "#7DCFFF", "#BB9AF7", "#9ECE6A"] },
    "nordic-frost": { label: "Nordic Frost", colors: ["#242933", "#88C0D0", "#8FBCBB", "#81A1C1", "#A3BE8C"] },
  };

  const SURFACE_QUICK_PRESETS = [
    {
      name: "Sắc nét (Mặc định)",
      surfaces: { sidebarOpacity: 64, panelOpacity: 42, chatOpacity: 66, userBubbleOpacity: 58, composerOpacity: 44, codeOpacity: 72, editorOpacity: 64, overlayOpacity: 96, titlebarOpacity: 74, glassBlur: 0, glassSaturate: 130 },
    },
    {
      name: "Kính mờ (Frosted)",
      surfaces: { sidebarOpacity: 42, panelOpacity: 28, chatOpacity: 46, userBubbleOpacity: 44, composerOpacity: 36, codeOpacity: 58, editorOpacity: 50, overlayOpacity: 84, titlebarOpacity: 52, glassBlur: 14, glassSaturate: 155 },
    },
    {
      name: "Siêu trong suốt",
      surfaces: { sidebarOpacity: 28, panelOpacity: 16, chatOpacity: 40, userBubbleOpacity: 38, composerOpacity: 28, codeOpacity: 52, editorOpacity: 42, overlayOpacity: 80, titlebarOpacity: 38, glassBlur: 6, glassSaturate: 135 },
    },
    {
      name: "Đậm dễ đọc",
      surfaces: { sidebarOpacity: 86, panelOpacity: 82, chatOpacity: 88, userBubbleOpacity: 82, composerOpacity: 76, codeOpacity: 90, editorOpacity: 88, overlayOpacity: 98, titlebarOpacity: 90, glassBlur: 0, glassSaturate: 110 },
    },
  ];

  const UI_FONTS = ["", "Segoe UI", "Inter", "Be Vietnam Pro", "Roboto", "Noto Sans"];
  const MONO_FONTS = ["", "JetBrains Mono", "Cascadia Code", "Fira Code", "Consolas", "Source Code Pro"];
  const POS_GRID = [
    ["left top", "↖"], ["center top", "↑"], ["right top", "↗"],
    ["left center", "←"], ["center center", "•"], ["right center", "→"],
    ["left bottom", "↙"], ["center bottom", "↓"], ["right bottom", "↘"],
  ];

  // --- Tiny DOM Builder (zero innerHTML, TrustedTypes safe) ---
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null) continue;
        if (k === "style" && typeof v === "object") Object.assign(node.style, v);
        else if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k === "disabled") node.disabled = Boolean(v);
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, String(v));
      }
    }
    if (children !== undefined) {
      const list = Array.isArray(children) ? children : [children];
      for (const c of list) {
        if (c === null || c === undefined || c === false) continue;
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function clamp(val, min, max, fallback) {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function sanitizeCssFont(val) {
    return String(val || "").replace(/\/\*|\*\/|[{};<>\\\r\n]/g, "").trim();
  }

  function isNoneAsset(val) {
    return /^(NONE|off|false)$/i.test(String(val || "").trim());
  }

  function normalizeHex(val) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(val || "").trim());
    return m ? `#${m[1].toUpperCase()}` : null;
  }

  function hexToRgbStr(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }

  function mixHex(hexA, hexB, weightB) {
    const a = /^#?([0-9a-f]{6})$/i.exec(String(hexA || "").trim());
    const b = /^#?([0-9a-f]{6})$/i.exec(String(hexB || "").trim());
    if (!a) return b ? `#${b[1].toUpperCase()}` : "#000000";
    if (!b) return `#${a[1].toUpperCase()}`;
    const na = parseInt(a[1], 16);
    const nb = parseInt(b[1], 16);
    const t = clamp(weightB, 0, 1, 0.5);
    const r = Math.round(((na >> 16) & 255) * (1 - t) + ((nb >> 16) & 255) * t);
    const g = Math.round(((na >> 8) & 255) * (1 - t) + ((nb >> 8) & 255) * t);
    const bl = Math.round((na & 255) * (1 - t) + (nb & 255) * t);
    return `#${[r, g, bl].map((x) => clamp(x, 0, 255, 0).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  }

  function countCssBraces(css) {
    let open = 0, close = 0, inComment = false, quote = null;
    for (let i = 0; i < css.length; i++) {
      const ch = css[i];
      const next = css[i + 1];
      if (inComment) {
        if (ch === "*" && next === "/") { inComment = false; i++; }
        continue;
      }
      if (quote) {
        if (ch === "\\") { i++; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "/" && next === "*") { inComment = true; i++; continue; }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === "{") open++;
      else if (ch === "}") close++;
    }
    return { open, close };
  }

  function loadAutoSavePref() {
    try {
      const v = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
      return v === null ? true : v !== "false";
    } catch {
      return true;
    }
  }

  function saveAutoSavePref(val) {
    try {
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, val ? "true" : "false");
    } catch {}
  }

  function isPlainObject(v) {
    return Boolean(v) && typeof v === "object" && !Array.isArray(v);
  }

  function syncPlainInPlace(target, source) {
    if (!isPlainObject(target) || !isPlainObject(source)) return clone(source);
    for (const key of Object.keys(target)) {
      if (!(key in source)) delete target[key];
    }
    for (const [key, val] of Object.entries(source)) {
      if (isPlainObject(val) && isPlainObject(target[key])) {
        syncPlainInPlace(target[key], val);
      } else if (Array.isArray(val) && Array.isArray(target[key])) {
        target[key].splice(0, target[key].length, ...clone(val));
      } else {
        target[key] = isPlainObject(val) || Array.isArray(val) ? clone(val) : val;
      }
    }
    return target;
  }

  function syncDraftFromConfig(nextCfg) {
    if (!nextCfg) return false;
    const prevJson = state.draft ? JSON.stringify(state.draft) : "";
    if (!state.draft || !isPlainObject(state.draft)) {
      state.draft = clone(nextCfg);
    } else {
      syncPlainInPlace(state.draft, nextCfg);
    }
    return JSON.stringify(state.draft) !== prevJson;
  }

  function mergeImportedConfig(base, rawImported) {
    const next = clone(base);
    const objKeys = ["wallpaperEffects", "surfaces", "avatars", "composer", "typography", "dark", "light", "loading", "studio"];
    for (const [k, v] of Object.entries(rawImported)) {
      if (k === "schemaVersion") continue;
      if (k === "agentAvatar" && isPlainObject(v)) {
        next.agentAvatar = {
          ...(next.agentAvatar || {}),
          ...v,
          bgStops: Array.isArray(v.bgStops) && v.bgStops.length >= 3 ? v.bgStops.slice(0, 3) : (next.agentAvatar && next.agentAvatar.bgStops) || ["#FAF7E6", "#F6ECC9", "#EBE3CC"],
          iconStops: Array.isArray(v.iconStops) && v.iconStops.length >= 3 ? v.iconStops.slice(0, 3) : (next.agentAvatar && next.agentAvatar.iconStops) || ["#1F6E97", "#285C84", "#0E3252"],
        };
      } else if (objKeys.includes(k) && isPlainObject(v)) {
        next[k] = { ...(next[k] || {}), ...v };
      } else if (!objKeys.includes(k) && k !== "agentAvatar") {
        next[k] = v;
      }
    }
    return next;
  }

  // --- Bridge to Electron Main Process ---
  let reqSeq = 1;
  const pending = new Map();
  let draftRevision = 0;
  let inFlightSave = false;
  let queuedSave = false;
  let activeDragCount = 0;
  let pendingDeferredRender = false;
  let pickingImage = false;
  let lastRenderedTab = null;

  const initialModeIsLight = Boolean(document.body && document.body.classList.contains("theme-light"));
  const state = {
    config: null,
    draft: null,
    profiles: [],
    library: [],
    thumbs: {},
    thumbAttempted: {},
    savedCustomCss: "",
    customCss: "",
    customCssDirty: false,
    dirty: false,
    autoSave: loadAutoSavePref(),
    activeTab: "profiles",
    wpModeTab: initialModeIsLight ? "light" : "dark",
    colorModeTab: initialModeIsLight ? "light" : "dark",
    newProfileName: "",
    confirmResetUntil: 0,
    confirmDeleteProfileId: "",
    confirmDeleteProfileUntil: 0,
    statusText: "",
    statusKind: "ok",
  };

  function sendCommand(action, payload = {}, timeoutMs = 20000) {
    const id = "kn-" + (reqSeq++);
    return new Promise((resolve, reject) => {
      let timer = null;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error("Timeout waiting for main process"));
          }
        }, timeoutMs);
      }
      pending.set(id, { resolve, reject, timer });
      try {
        console.log("__KN_STUDIO__" + JSON.stringify({ ...payload, id, action }));
      } catch (e) {
        if (timer) clearTimeout(timer);
        pending.delete(id);
        reject(e);
      }
    });
  }

  window.__knStudioReceive = (msg) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.id && pending.has(msg.id)) {
      const entry = pending.get(msg.id);
      if (entry.timer) clearTimeout(entry.timer);
      pending.delete(msg.id);
      if (msg.ok === false) entry.reject(new Error(msg.error || "Unknown error"));
      else entry.resolve(msg.data);
      return;
    }
    if (msg.event === "state-updated" && msg.data) {
      applyReceivedState(msg.data, { external: Boolean(msg.external) });
    }
  };

  function pruneThumbsToLibrary() {
    const validById = new Map(state.library.map((x) => [x.id, x]));
    for (const key of Object.keys(state.thumbs)) {
      if (!validById.has(key)) delete state.thumbs[key];
    }
    for (const [key, mtime] of Object.entries(state.thumbAttempted)) {
      const item = validById.get(key);
      if (!item || item.mtimeMs !== mtime) delete state.thumbAttempted[key];
    }
  }

  function applyReceivedState(data, opts = {}) {
    if (!data || typeof data !== "object") return;
    const isExternal = Boolean(opts.external);
    const force = Boolean(opts.force);

    if (Array.isArray(data.profiles)) state.profiles = data.profiles;
    if (Array.isArray(data.library)) {
      state.library = data.library;
      pruneThumbsToLibrary();
    }
    if (data.thumbs && typeof data.thumbs === "object") {
      state.thumbs = { ...state.thumbs, ...data.thumbs };
    }
    if (typeof data.customCss === "string") {
      state.savedCustomCss = data.customCss;
      if (!state.customCssDirty || force) {
        state.customCss = data.customCss;
        state.customCssDirty = false;
      }
    }

    if (data.config) {
      state.config = clone(data.config);
      if (force || (!state.dirty && activeDragCount === 0)) {
        syncDraftFromConfig(data.config);
        state.dirty = false;
        applyLivePreview(state.draft);
      } else {
        setStatus("Cấu hình trên đĩa vừa thay đổi (đang giữ bản nháp chưa lưu)", "busy");
      }
    }

    if (activeDragCount > 0 && !force) {
      pendingDeferredRender = true;
      updateBadgesAndButtons();
      return;
    }
    if (force && activeDragCount > 0) {
      activeDragCount = 0;
      pendingDeferredRender = false;
    }
    renderAll();
  }

  // --- Pure CSS-Variable 60FPS Preview Overrides on document.documentElement ---
  const LIVE_VAR_NAMES = [
    "--kn-wp-pos", "--kn-wp-pos-light", "--kn-wp-size", "--kn-wp-filter", "--kn-wp-opacity", "--kn-wp-scale",
    "--kn-scrim-opacity", "--kn-scrim-image-dark", "--kn-scrim-image-light",
    "--kn-sidebar-a", "--kn-sidebar-top-a", "--kn-sidebar-mid-a",
    "--kn-panel-a", "--kn-panel-max-a", "--kn-chat-a", "--kn-card-a", "--kn-ub-a", "--kn-comp-a",
    "--kn-code-a", "--kn-editor-a", "--kn-editor-side-a", "--kn-overlay-a", "--kn-titlebar-a",
    "--kn-backdrop", "--kn-panel-radius", "--kn-card-radius", "--kn-composer-radius", "--kn-bubble-radius",
    "--kn-ui-font", "--kn-mono-font", "--kn-chat-font-size", "--kn-code-font-size", "--kn-line-height",
    "--kn-user-av-display", "--kn-user-av-size", "--kn-user-av-top", "--kn-user-av-radius",
    "--kn-user-av-rotate", "--kn-user-av-mt", "--kn-user-av-mr",
    "--kn-agent-av-display", "--kn-agent-av-size", "--kn-agent-av-top", "--kn-agent-av-radius",
    "--kn-agent-av-rotate", "--kn-agent-av-mt", "--kn-agent-av-ml",
    "--kn-d-surf-rgb", "--kn-d-side-rgb", "--kn-d-over-rgb", "--kn-d-scrim-rgb", "--kn-d-chrome-rgb",
    "--kn-d-blue-rgb", "--kn-d-aqua-rgb", "--kn-d-sel-rgb", "--kn-d-pri-rgb",
    "--kn-l-surf-rgb", "--kn-l-side-rgb", "--kn-l-over-rgb", "--kn-l-scrim-rgb", "--kn-l-chrome-rgb", "--kn-l-pri-rgb",
    "--kn-comp-rim-1-rgb", "--kn-comp-rim-2-rgb", "--kn-comp-rim-3-rgb",
    "--kn-comp-bg-1-rgb", "--kn-comp-bg-2-rgb", "--kn-comp-bg-3-rgb",
    "--kn-ub-bg-1-rgb", "--kn-ub-bg-2-rgb", "--kn-ub-border-rgb",
    "--kw-sumiInk0", "--kw-sumiInk1", "--kw-sumiInk2", "--kw-sumiInk3", "--kw-sumiInk4", "--kw-waveBlue1",
    "--kw-fujiWhite", "--kw-oldWhite", "--kw-fujiGray", "--kw-waveBlue2", "--kw-crystalBlue",
    "--kw-carpYellow", "--kw-waveAqua", "--kw-springGreen", "--kw-sakuraPink", "--kw-oniViolet", "--kw-surimiOrange",
    "--kl-white0", "--kl-white1", "--kl-white2", "--kl-white3", "--kl-ink1", "--kl-ink2", "--kl-gray2",
    "--px-chrome-dark-bg", "--px-chrome-dark-fg", "--px-chrome-light-bg", "--px-chrome-light-fg",
  ];

  function buildScrimImage(rgbVar, isLight, style) {
    const s = String(style || "directional").trim().toLowerCase();
    if (s === "none") return "none";
    if (s === "solid" || s === "uniform") {
      return `linear-gradient(180deg, rgba(${rgbVar}, 1) 0%, rgba(${rgbVar}, 1) 100%)`;
    }
    if (s === "gradient") {
      return isLight
        ? `linear-gradient(180deg, rgba(${rgbVar}, 0.42) 0%, rgba(${rgbVar}, 0.68) 55%, rgba(${rgbVar}, 0.90) 100%)`
        : `linear-gradient(180deg, rgba(${rgbVar}, 0.34) 0%, rgba(${rgbVar}, 0.62) 55%, rgba(${rgbVar}, 0.88) 100%)`;
    }
    if (s === "vignette") {
      return isLight
        ? `radial-gradient(65% 65% at 50% 48%, rgba(${rgbVar}, 0.25) 0%, rgba(${rgbVar}, 0.84) 100%)`
        : `radial-gradient(65% 65% at 50% 48%, rgba(${rgbVar}, 0.18) 0%, rgba(${rgbVar}, 0.82) 100%)`;
    }
    return isLight
      ? `radial-gradient(52% 48% at 86% 18%, rgba(${rgbVar}, 0.36) 0%, rgba(${rgbVar}, 0.78) 100%), linear-gradient(180deg, rgba(${rgbVar}, 0.58) 0%, rgba(${rgbVar}, 0.76) 100%)`
      : `radial-gradient(48% 46% at 86% 18%, rgba(${rgbVar}, 0.18) 0%, rgba(${rgbVar}, 0.72) 100%), linear-gradient(108deg, rgba(${rgbVar}, 0.72) 0%, rgba(${rgbVar}, 0.52) 56%, rgba(${rgbVar}, 0.28) 100%)`;
  }

  function buildGeminiStarSvgUrl(bgStops, iconStops) {
    const defBg = ["#FAF7E6", "#F6ECC9", "#EBE3CC"];
    const defIcon = ["#1F6E97", "#285C84", "#0E3252"];
    const [b0, b1, b2] = [0, 1, 2].map((i) => normalizeHex(bgStops && bgStops[i]) || defBg[i]);
    const [i0, i1, i2] = [0, 1, 2].map((i) => normalizeHex(iconStops && iconStops[i]) || defIcon[i]);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">` +
      `<defs>` +
      `<linearGradient id="kbg" x1="0%" y1="0%" x2="100%" y2="100%">` +
      `<stop offset="0%" stop-color="${b0}"/><stop offset="55%" stop-color="${b1}"/><stop offset="100%" stop-color="${b2}"/>` +
      `</linearGradient>` +
      `<linearGradient id="kgem" x1="15%" y1="15%" x2="85%" y2="85%">` +
      `<stop offset="0%" stop-color="${i0}"/><stop offset="52%" stop-color="${i1}"/><stop offset="100%" stop-color="${i2}"/>` +
      `</linearGradient>` +
      `</defs>` +
      `<rect width="36" height="36" fill="url(#kbg)"/>` +
      `<path d="M18 5.5 C18.35 13.6 22.4 17.65 30.5 18 C22.4 18.35 18.35 22.4 18 30.5 C17.65 22.4 13.6 18.35 5.5 18 C13.6 17.65 17.65 13.6 18 5.5 Z" fill="url(#kgem)"/>` +
      `</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function clearLiveDomOverrides() {
    const docEl = document.documentElement;
    const rs = docEl.style;
    for (const k of LIVE_VAR_NAMES) rs.removeProperty(k);
    if (docEl.dataset) {
      delete docEl.dataset.knUiFont;
      delete docEl.dataset.knMonoFont;
      delete docEl.dataset.knChatSize;
      delete docEl.dataset.knCodeSize;
    }
    if (typeof docEl.removeAttribute === "function") {
      docEl.removeAttribute("data-kn-ui-font");
      docEl.removeAttribute("data-kn-mono-font");
      docEl.removeAttribute("data-kn-chat-size");
      docEl.removeAttribute("data-kn-code-size");
    }
    const legacySt = document.getElementById("kn-studio-live-style");
    if (legacySt) legacySt.remove();
  }

  function applyLivePreview(cfg) {
    if (!cfg) return;
    const rs = document.documentElement.style;
    const fx = cfg.wallpaperEffects || {};
    const sf = cfg.surfaces || {};
    const av = cfg.avatars || {};
    const comp = cfg.composer || {};
    const d = cfg.dark || {};
    const l = cfg.light || {};
    const typo = cfg.typography || {};

    const wpBlur = clamp(fx.blur, 0, 40, 0);
    const wpBright = clamp(fx.brightness, 20, 200, 100);
    const wpContrast = clamp(fx.contrast, 30, 200, 100);
    const wpSat = clamp(fx.saturate, 0, 250, 100);
    const wpOpacity = (clamp(fx.opacity, 0, 100, 100) / 100).toFixed(2);
    const rawScale = clamp(fx.scale, 100, 200, 100) / 100;
    const wpScale = Math.max(rawScale, wpBlur > 0 ? 1 + wpBlur * 0.004 : 1).toFixed(3);
    const wpFit = /^(cover|contain|auto|100% 100%)$/.test(String(cfg.wallpaperFit || "")) ? cfg.wallpaperFit : "cover";
    const wpPos = String(cfg.wallpaperPosition || "right top").replace(/[;{}<>\r\n]/g, "").trim() || "right top";
    const wpPosLight = !cfg.wallpaperPositionLight || cfg.wallpaperPositionLight === "SAME"
      ? wpPos
      : (String(cfg.wallpaperPositionLight).replace(/[;{}<>\r\n]/g, "").trim() || wpPos);

    rs.setProperty("--kn-wp-pos", wpPos);
    rs.setProperty("--kn-wp-pos-light", wpPosLight);
    rs.setProperty("--kn-wp-size", wpFit);
    rs.setProperty("--kn-wp-filter", `blur(${wpBlur}px) brightness(${wpBright}%) contrast(${wpContrast}%) saturate(${wpSat}%)`);
    rs.setProperty("--kn-wp-opacity", wpOpacity);
    rs.setProperty("--kn-wp-scale", wpScale);

    const scrimStyle = fx.scrimStyle || "directional";
    rs.setProperty("--kn-scrim-opacity", (clamp(fx.scrimOpacity, 0, 100, 75) / 100).toFixed(2));
    rs.setProperty("--kn-scrim-image-dark", buildScrimImage("var(--kn-d-scrim-rgb)", false, scrimStyle));
    rs.setProperty("--kn-scrim-image-light", buildScrimImage("var(--kn-l-scrim-rgb)", true, scrimStyle));

    const sideA = clamp(sf.sidebarOpacity, 0, 100, 64) / 100;
    rs.setProperty("--kn-sidebar-a", sideA.toFixed(2));
    rs.setProperty("--kn-sidebar-top-a", Math.min(1, sideA + 0.08).toFixed(2));
    rs.setProperty("--kn-sidebar-mid-a", Math.max(0, sideA - 0.10).toFixed(2));
    const panA = clamp(sf.panelOpacity, 0, 100, 42) / 100;
    rs.setProperty("--kn-panel-a", panA.toFixed(2));
    rs.setProperty("--kn-panel-max-a", Math.min(1, panA + 0.14).toFixed(2));
    const chatA = (clamp(sf.chatOpacity, 0, 100, 66) / 100).toFixed(2);
    rs.setProperty("--kn-chat-a", chatA);
    rs.setProperty("--kn-card-a", chatA);
    rs.setProperty("--kn-ub-a", (clamp(sf.userBubbleOpacity, 0, 100, 58) / 100).toFixed(2));
    rs.setProperty("--kn-comp-a", (clamp(sf.composerOpacity, 0, 100, 44) / 100).toFixed(2));
    rs.setProperty("--kn-code-a", (clamp(sf.codeOpacity, 0, 100, 72) / 100).toFixed(2));
    const edA = clamp(sf.editorOpacity, 0, 100, 64) / 100;
    rs.setProperty("--kn-editor-a", edA.toFixed(2));
    rs.setProperty("--kn-editor-side-a", Math.max(0, edA * 0.55).toFixed(2));
    rs.setProperty("--kn-overlay-a", (clamp(sf.overlayOpacity, 45, 100, 96) / 100).toFixed(2));
    rs.setProperty("--kn-titlebar-a", (clamp(sf.titlebarOpacity, 0, 100, 74) / 100).toFixed(2));

    const gb = clamp(sf.glassBlur, 0, 32, 0);
    const gs = clamp(sf.glassSaturate, 80, 220, 130);
    rs.setProperty("--kn-backdrop", gb > 0 ? `blur(${gb}px) saturate(${gs}%)` : "none");
    rs.setProperty("--kn-panel-radius", `${clamp(sf.panelRadius, 0, 32, 14)}px`);
    rs.setProperty("--kn-card-radius", `${clamp(sf.cardRadius, 0, 32, 12)}px`);
    rs.setProperty("--kn-composer-radius", `${clamp(sf.composerRadius, 0, 32, 16)}px`);
    rs.setProperty("--kn-bubble-radius", `${clamp(sf.bubbleRadius, 0, 32, 16)}px`);

    const uiFont = sanitizeCssFont(typo.uiFont);
    const monoFont = sanitizeCssFont(typo.monoFont);
    const chatFontSize = clamp(typo.chatFontSize, 0, 26, 0);
    const codeFontSize = clamp(typo.codeFontSize, 0, 24, 0);
    const uiFontStack = uiFont ? `${uiFont}, "Segoe UI", system-ui, sans-serif` : "none";
    const monoFontStack = monoFont ? `${monoFont}, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` : "none";
    const chatSizePx = chatFontSize > 0 ? `${clamp(chatFontSize, 10, 26, 14)}px` : "none";
    const codeSizePx = codeFontSize > 0 ? `${clamp(codeFontSize, 9, 24, 13)}px` : "none";
    const lineHeightVal = clamp(typo.lineHeight, 1.15, 2.2, 1.62).toFixed(2);
    rs.setProperty("--kn-ui-font", uiFontStack);
    rs.setProperty("--kn-mono-font", monoFontStack);
    rs.setProperty("--kn-chat-font-size", chatSizePx);
    rs.setProperty("--kn-code-font-size", codeSizePx);
    rs.setProperty("--kn-line-height", lineHeightVal);

    const docEl = document.documentElement;
    const setDataFlag = (camelKey, attrName, active) => {
      const val = active ? "1" : "0";
      if (docEl.dataset) docEl.dataset[camelKey] = val;
      if (typeof docEl.setAttribute === "function") docEl.setAttribute(attrName, val);
    };
    setDataFlag("knUiFont", "data-kn-ui-font", Boolean(uiFont));
    setDataFlag("knMonoFont", "data-kn-mono-font", Boolean(monoFont));
    setDataFlag("knChatSize", "data-kn-chat-size", chatFontSize > 0);
    setDataFlag("knCodeSize", "data-kn-code-size", codeFontSize > 0);

    const userAvNone = isNoneAsset(cfg.userAvatar);
    const uVis = av.userVisible !== false && !userAvNone;
    const uSz = clamp(av.userSize, 18, 64, 36);
    rs.setProperty("--kn-user-av-display", uVis ? "block" : "none");
    rs.setProperty("--kn-user-av-size", `${uSz}px`);
    rs.setProperty("--kn-user-av-top", `${Math.round(-uSz * 0.66)}px`);
    rs.setProperty("--kn-user-av-radius", `${clamp(av.userRadius, 0, 50, 18)}%`);
    rs.setProperty("--kn-user-av-rotate", `${clamp(av.userRotate, -45, 45, 18)}deg`);
    rs.setProperty("--kn-user-av-mt", `${uVis ? Math.round(uSz * 0.72) : 0}px`);
    rs.setProperty("--kn-user-av-mr", `${uVis ? Math.max(14, Math.round(uSz * 0.39)) : 0}px`);

    const agentAvNone = isNoneAsset(cfg.agentAvatar && cfg.agentAvatar.image);
    const aVis = av.agentVisible !== false && !agentAvNone;
    const aSz = clamp(av.agentSize, 18, 64, 36);
    rs.setProperty("--kn-agent-av-display", aVis ? "block" : "none");
    rs.setProperty("--kn-agent-av-size", `${aSz}px`);
    rs.setProperty("--kn-agent-av-top", `${Math.round(-aSz * 0.55)}px`);
    rs.setProperty("--kn-agent-av-radius", `${clamp(av.agentRadius, 0, 50, 18)}%`);
    rs.setProperty("--kn-agent-av-rotate", `${clamp(av.agentRotate, -45, 45, -18)}deg`);
    rs.setProperty("--kn-agent-av-mt", `${aVis ? Math.round(aSz * 0.64) : 0}px`);
    rs.setProperty("--kn-agent-av-ml", `${aVis ? Math.max(6, Math.round(aSz * 0.17)) : 0}px`);

    const rgbPairs = [
      ["--kn-d-surf-rgb", d.surfaceBase], ["--kn-d-side-rgb", d.sidebarBase], ["--kn-d-over-rgb", d.overlayBase],
      ["--kn-d-scrim-rgb", d.scrimBase], ["--kn-d-chrome-rgb", d.chromeBg], ["--kn-d-blue-rgb", d.accentBlue],
      ["--kn-d-aqua-rgb", d.accentAqua], ["--kn-d-sel-rgb", d.selection], ["--kn-d-pri-rgb", d.primary],
      ["--kn-l-surf-rgb", l.surfaceBase], ["--kn-l-side-rgb", l.sidebarBase], ["--kn-l-over-rgb", l.overlayBase],
      ["--kn-l-scrim-rgb", l.scrimBase], ["--kn-l-chrome-rgb", l.chromeBg], ["--kn-l-pri-rgb", l.primary],
      ["--kn-comp-rim-1-rgb", comp.rimStart], ["--kn-comp-rim-2-rgb", comp.rimMid], ["--kn-comp-rim-3-rgb", comp.rimEnd],
      ["--kn-comp-bg-1-rgb", comp.innerStart], ["--kn-comp-bg-2-rgb", comp.innerMid], ["--kn-comp-bg-3-rgb", comp.innerEnd],
      ["--kn-ub-bg-1-rgb", comp.userBubbleStart], ["--kn-ub-bg-2-rgb", comp.userBubbleEnd], ["--kn-ub-border-rgb", comp.userBubbleBorder],
    ];
    for (const [k, hex] of rgbPairs) {
      const rgb = hexToRgbStr(hex);
      if (rgb) rs.setProperty(k, rgb);
    }

    const sumiInk4 = mixHex(d.overlayBase || "#0F141D", d.textSubtle || "#8A8980", 0.35);
    const waveBlue1 = mixHex(d.surfaceBase || "#11161F", d.selection || "#2D4F67", 0.55);
    const directVars = [
      ["--kw-sumiInk0", d.scrimBase], ["--kw-sumiInk1", d.sidebarBase], ["--kw-sumiInk2", d.chromeBg],
      ["--kw-sumiInk3", d.surfaceBase], ["--kw-sumiInk4", sumiInk4], ["--kw-waveBlue1", waveBlue1],
      ["--kw-fujiWhite", d.text], ["--kw-oldWhite", d.textMuted], ["--kw-fujiGray", d.textSubtle],
      ["--kw-waveBlue2", d.selection], ["--kw-crystalBlue", d.accentBlue], ["--kw-carpYellow", d.primary],
      ["--kw-waveAqua", d.accentAqua], ["--kw-springGreen", d.accentGreen], ["--kw-sakuraPink", d.accentPink],
      ["--kw-oniViolet", d.accentViolet], ["--kw-surimiOrange", d.accentOrange],
      ["--kl-white0", l.paper0], ["--kl-white1", l.paper1], ["--kl-white2", l.paper2],
      ["--kl-white3", l.paper3], ["--kl-ink1", l.text], ["--kl-ink2", l.primary], ["--kl-gray2", l.textMuted],
      ["--px-chrome-dark-bg", d.chromeBg], ["--px-chrome-dark-fg", d.chromeFg],
      ["--px-chrome-light-bg", l.chromeBg], ["--px-chrome-light-fg", l.chromeFg],
    ];
    for (const [k, v] of directVars) {
      const hex = normalizeHex(v);
      if (hex) rs.setProperty(k, hex);
    }

    const liveRules = [];
    if (uiFont) {
      liveRules.push(
        `html, body { --font-sans: ${uiFontStack} !important; font-family: ${uiFontStack} !important; }`,
        `body :not(:where(pre, pre *, code, code *, kbd, samp, .font-mono, .font-mono *, .monaco-editor, .monaco-editor *, .xterm, .xterm *, [class*="material-symbols"], [class*="codicon"], [data-icon], [id="kn-studio-host"], [id="kn-studio-host"] *)) { font-family: ${uiFontStack} !important; }`
      );
    }
    if (monoFont) {
      liveRules.push(
        `html, body { --font-mono: ${monoFontStack} !important; }`,
        `body :is(pre, pre *, code, code *, kbd, samp, .font-mono, .font-mono *, .monaco-editor, .monaco-editor .view-lines, .monaco-editor .view-line, .xterm, .xterm-rows) { --font-mono: ${monoFontStack} !important; font-family: ${monoFontStack} !important; }`
      );
    }
    if (chatFontSize > 0) {
      liveRules.push(
        `body :is([data-markdown-root], [data-markdown-root] :is(p, li, ul, ol, blockquote, td, th), [data-testid="user-message-bubble"], [data-testid="user-message-bubble"] *, .agy-user-bubble, .agy-user-bubble *, .leading-relaxed:not(:where([role="menu"] *, [role="listbox"] *, [role="dialog"] *, [role="tooltip"] *, [data-mention-menu] *, .surface-composer *, [id="kn-studio-host"] *))) { font-size: ${chatSizePx} !important; }`
      );
    }
    if (codeFontSize > 0) {
      liveRules.push(
        `body :is(pre, pre *, code, kbd, samp, .monaco-editor .view-lines, .monaco-editor .view-line, .xterm-rows) { font-size: ${codeSizePx} !important; }`
      );
    }
    liveRules.push(
      `body :is([data-markdown-root], [data-markdown-root] :is(p, li, ul, ol, blockquote, td, th), [data-testid="user-message-bubble"], [data-testid="user-message-bubble"] *, .agy-user-bubble, .agy-user-bubble *, .leading-relaxed:not(:where([role="menu"] *, [role="listbox"] *, [role="dialog"] *, [role="tooltip"] *, [data-mention-menu] *, .surface-composer *, [id="kn-studio-host"] *))) { line-height: ${lineHeightVal} !important; }`
    );
    if (cfg.agentAvatar && cfg.agentAvatar.image === "SVG_STAR") {
      const starUrl = buildGeminiStarSvgUrl(cfg.agentAvatar.bgStops, cfg.agentAvatar.iconStops);
      liveRules.push(
        `:root { --kn-gemini-avatar: ${starUrl}; }`,
        `html body :is([data-testid="agent-response"] div:has(> [data-markdown-root]), [data-testid="agent-response"] div[class~="px-2"][class~="py-1"]:has(> [data-markdown-root]), .agy-agent-bubble-frame)::before { background-image: ${starUrl} !important; }`
      );
    }
    let liveStyle = document.getElementById("kn-studio-live-style");
    const styleTarget = document.head || document.documentElement;
    if (!liveStyle && styleTarget) {
      liveStyle = document.createElement("style");
      liveStyle.id = "kn-studio-live-style";
      styleTarget.appendChild(liveStyle);
    } else if (liveStyle && styleTarget) {
      try { styleTarget.appendChild(liveStyle); } catch {}
    }
    if (liveStyle) liveStyle.textContent = liveRules.join("\n");
  }

  let saveDebounce = null;

  async function flushConfigSave() {
    if (!state.dirty || !state.draft) return true;
    if (inFlightSave) {
      queuedSave = true;
      return true;
    }
    inFlightSave = true;
    let ok = false;
    try {
      do {
        queuedSave = false;
        const sentRev = draftRevision;
        const payloadCfg = clone(state.draft);
        setStatus("Đang lưu & áp dụng...", "busy");
        const data = await sendCommand("apply-config", { config: payloadCfg });
        if (data && data.config) {
          state.config = clone(data.config);
          if (Array.isArray(data.profiles)) state.profiles = data.profiles;
          if (Array.isArray(data.library)) {
            state.library = data.library;
            pruneThumbsToLibrary();
          }
          if (sentRev === draftRevision) {
            const normalizedChanged = syncDraftFromConfig(data.config);
            state.dirty = false;
            applyLivePreview(state.draft);
            updateBadgesAndButtons();
            if (normalizedChanged && panel.classList.contains("open")) {
              if (activeDragCount > 0) {
                pendingDeferredRender = true;
              } else {
                renderBody();
              }
            }
          } else if (state.autoSave) {
            queuedSave = true;
          }
        }
        ok = true;
      } while (queuedSave);
      if (!state.dirty) {
        setStatus("Đã lưu & đồng bộ live!", "ok");
      }
    } catch (e) {
      setStatus("Lỗi lưu: " + e.message, "err");
      ok = false;
    } finally {
      inFlightSave = false;
      updateBadgesAndButtons();
    }
    return ok;
  }

  async function saveCustomCssNow(reRender = false) {
    const braces = countCssBraces(state.customCss || "");
    if (braces.open !== braces.close) {
      setStatus(`Lỗi CSS: ngoặc { (${braces.open}) ≠ } (${braces.close})`, "err");
      return false;
    }
    try {
      setStatus("Đang áp dụng custom.css...", "busy");
      const data = await sendCommand("save-custom-css", { customCss: state.customCss || "" });
      state.customCssDirty = false;
      if (data && typeof data.customCss === "string") {
        state.savedCustomCss = data.customCss;
        state.customCss = data.customCss;
      } else {
        state.savedCustomCss = state.customCss || "";
      }
      if (data && data.config) {
        state.config = clone(data.config);
        if (!state.dirty) {
          const changed = syncDraftFromConfig(data.config);
          applyLivePreview(state.draft);
          if (changed && !reRender && panel.classList.contains("open")) {
            if (activeDragCount > 0) pendingDeferredRender = true;
            else renderBody();
          }
        }
      }
      updateBadgesAndButtons();
      if (reRender && panel.classList.contains("open")) {
        if (activeDragCount > 0) pendingDeferredRender = true;
        else renderBody();
      }
      setStatus("Đã áp dụng custom.css!", "ok");
      return true;
    } catch (e) {
      setStatus("Lỗi CSS: " + e.message, "err");
      return false;
    }
  }

  async function saveAllPending() {
    clearTimeout(saveDebounce);
    let ok = true;
    if (state.dirty) ok = await flushConfigSave();
    if (ok && state.customCssDirty) ok = await saveCustomCssNow(true);
    return ok;
  }

  function commitDraft(options = false) {
    const opts = typeof options === "boolean"
      ? { isCommit: options, forceDisk: false }
      : { isCommit: true, forceDisk: false, ...options };
    draftRevision++;
    state.dirty = true;
    applyLivePreview(state.draft);
    updateBadgesAndButtons();

    if (opts.forceDisk) {
      clearTimeout(saveDebounce);
      saveDebounce = setTimeout(() => { void flushConfigSave(); }, 10);
      return;
    }
    if (!state.autoSave) return;
    clearTimeout(saveDebounce);
    saveDebounce = setTimeout(() => { void flushConfigSave(); }, opts.isCommit ? 30 : 380);
  }

  // --- Host & Shadow DOM Setup ---
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "position:fixed;inset:0;z-index:2147483630;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "open" });

  const STUDIO_CSS = `
    :host { all: initial; font-family: "Segoe UI", system-ui, -apple-system, sans-serif; font-size: 12px; color: #EAE6D3; }
    * { box-sizing: border-box; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(126,156,216,0.32); border-radius: 999px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(230,195,132,0.55); }

    .pill {
      position: fixed; bottom: 16px; right: 20px; z-index: 2;
      pointer-events: auto; display: flex; align-items: center; gap: 6px;
      padding: 7px 13px; border-radius: 999px;
      border: 1px solid rgba(122,168,159,0.45);
      background: rgba(15, 20, 29, 0.86);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      color: #EAE6D3; font-size: 12px; font-weight: 600;
      cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.42);
      transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
    }
    .pill:hover { transform: translateY(-1px) scale(1.03); border-color: #E6C384; background: rgba(20, 28, 42, 0.94); }
    .pill.pos-bottom-left { right: auto; left: 20px; }
    .pill.pos-top-right { bottom: auto; top: 40px; right: 20px; }
    .pill.hidden { display: none; }

    .panel {
      position: fixed; bottom: 18px; right: 20px; z-index: 3;
      width: 436px; max-width: calc(100vw - 24px); max-height: 84vh;
      pointer-events: auto; display: none; flex-direction: column;
      border-radius: 16px; border: 1px solid rgba(126,156,216,0.28);
      background: rgba(14, 18, 27, 0.93);
      backdrop-filter: blur(22px) saturate(140%); -webkit-backdrop-filter: blur(22px) saturate(140%);
      box-shadow: 0 24px 64px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08);
      overflow: hidden;
    }
    .panel.open { display: flex; }

    .header {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 10px 14px; border-bottom: 1px solid rgba(126,156,216,0.16);
      background: rgba(10, 14, 22, 0.55); cursor: grab; user-select: none;
    }
    .header:active { cursor: grabbing; }
    .title-wrap { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .title { font-size: 13px; font-weight: 700; color: #EAE6D3; letter-spacing: 0.2px; white-space: nowrap; }
    .badge {
      font-size: 10px; padding: 2px 7px; border-radius: 999px;
      background: rgba(122,168,159,0.18); border: 1px solid rgba(122,168,159,0.35);
      color: #7AA89F; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 112px;
    }
    .hbtns { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
    .icon-btn {
      border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05);
      color: #CFC8A3; border-radius: 7px; padding: 4px 8px; font-size: 11px; font-weight: 600;
      cursor: pointer; transition: all 120ms ease;
    }
    .icon-btn:hover { background: rgba(255,255,255,0.12); color: #fff; border-color: rgba(230,195,132,0.45); }
    .icon-btn.primary { background: rgba(230,195,132,0.20); color: #E6C384; border-color: rgba(230,195,132,0.45); }
    .icon-btn.primary.dirty { background: rgba(230,195,132,0.88); color: #131720; }
    .icon-btn.danger:hover { background: rgba(228,104,118,0.22); color: #ff8e99; border-color: rgba(228,104,118,0.45); }

    .tabs {
      display: flex; gap: 4px; padding: 7px 10px;
      border-bottom: 1px solid rgba(126,156,216,0.14);
      background: rgba(12, 16, 24, 0.55); overflow-x: auto;
    }
    .tab {
      flex: 1; text-align: center; padding: 6px 6px; border-radius: 8px;
      border: 1px solid transparent; background: transparent; color: #9c9888;
      font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap;
      transition: all 120ms ease;
    }
    .tab:hover { color: #EAE6D3; background: rgba(255,255,255,0.05); }
    .tab.active { color: #E6C384; background: rgba(45,79,103,0.45); border-color: rgba(122,168,159,0.35); }

    .body {
      flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 12px;
    }

    .footer {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 7px 14px; border-top: 1px solid rgba(126,156,216,0.14);
      background: rgba(10, 14, 22, 0.55); font-size: 11px; color: #8A8980;
    }
    .status-ok { color: #98BB6C; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status-busy { color: #E6C384; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status-err { color: #E46876; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .sec {
      background: rgba(20, 26, 38, 0.56); border: 1px solid rgba(126,156,216,0.14);
      border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 9px;
    }
    .sec-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      color: #7AA89F; display: flex; align-items: center; justify-content: space-between; gap: 6px;
    }
    .hint { font-size: 10.5px; color: #9c9888; font-weight: 400; text-transform: none; letter-spacing: 0; }

    .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .col { display: flex; flex-direction: column; gap: 4px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }

    .slider-row { display: flex; flex-direction: column; gap: 3px; }
    .slider-head { display: flex; justify-content: space-between; font-size: 11.5px; color: #CFC8A3; }
    .slider-val { color: #E6C384; font-weight: 600; font-variant-numeric: tabular-nums; }
    input[type="range"] {
      -webkit-appearance: none; appearance: none; width: 100%; height: 5px;
      background: rgba(126,156,216,0.22); border-radius: 999px; outline: none; cursor: pointer;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%;
      background: #E6C384; border: 2px solid #131720; box-shadow: 0 1px 4px rgba(0,0,0,0.5);
      cursor: pointer; transition: transform 100ms ease;
    }
    input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.15); }

    .btn {
      padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(126,156,216,0.24);
      background: rgba(34, 50, 73, 0.55); color: #EAE6D3; font-size: 11.5px; font-weight: 600;
      cursor: pointer; transition: all 120ms ease; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
    }
    .btn:hover:not(:disabled) { background: rgba(45, 79, 103, 0.85); border-color: rgba(230,195,132,0.5); }
    .btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .btn.accent { background: rgba(122,168,159,0.22); border-color: rgba(122,168,159,0.5); color: #9cd5c9; }
    .btn.accent:hover:not(:disabled) { background: rgba(122,168,159,0.38); color: #fff; }
    .btn.gold { background: rgba(230,195,132,0.2); border-color: rgba(230,195,132,0.48); color: #E6C384; }
    .btn.danger { background: rgba(228,104,118,0.22); border-color: rgba(228,104,118,0.55); color: #ff9aa4; }
    .btn.active { background: rgba(230,195,132,0.26); border-color: #E6C384; color: #fff; }
    .btn.sm { padding: 4px 8px; font-size: 11px; }

    input[type="text"], textarea, select {
      width: 100%; padding: 6px 8px; border-radius: 8px;
      border: 1px solid rgba(126,156,216,0.24); background: rgba(11, 15, 23, 0.78);
      color: #EAE6D3; font-size: 11.5px; outline: none; font-family: inherit;
    }
    input[type="text"]:focus, textarea:focus, select:focus { border-color: #E6C384; }
    textarea.code { font-family: Consolas, "Cascadia Code", monospace; font-size: 11px; min-height: 140px; resize: vertical; line-height: 1.45; }

    .seg { display: flex; background: rgba(11,15,23,0.7); padding: 2px; border-radius: 9px; border: 1px solid rgba(126,156,216,0.16); gap: 2px; }
    .seg button {
      flex: 1; border: none; background: transparent; color: #9c9888; padding: 5px 8px;
      border-radius: 7px; font-size: 11px; font-weight: 600; cursor: pointer;
    }
    .seg button.active { background: rgba(45,79,103,0.75); color: #EAE6D3; }

    .profile-card {
      border: 1px solid rgba(126,156,216,0.18); background: rgba(13, 18, 27, 0.72);
      border-radius: 10px; padding: 8px 9px; cursor: pointer; display: flex; flex-direction: column; gap: 5px;
      transition: all 120ms ease; position: relative;
    }
    .profile-card:hover { border-color: rgba(230,195,132,0.55); transform: translateY(-1px); }
    .profile-card.active { border-color: #E6C384; background: rgba(45, 79, 103, 0.35); box-shadow: 0 0 0 1px rgba(230,195,132,0.25); }
    .pname { font-weight: 700; font-size: 12px; color: #EAE6D3; padding-right: 24px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pdesc { font-size: 10.5px; color: #8A8980; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .swatches { display: flex; gap: 4px; align-items: center; }
    .dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.22); }
    .pdel {
      position: absolute; top: 6px; right: 6px; border: none; background: transparent;
      color: #8A8980; cursor: pointer; font-size: 10px; font-weight: 700; padding: 2px 5px; border-radius: 4px;
    }
    .pdel:hover, .pdel.confirming { color: #ff8e99; background: rgba(228,104,118,0.22); }

    .dropzone {
      border: 1.5px dashed rgba(122,168,159,0.45); border-radius: 10px; padding: 12px;
      text-align: center; color: #CFC8A3; background: rgba(122,168,159,0.06);
      cursor: pointer; transition: all 140ms ease; font-size: 11.5px;
    }
    .dropzone.dragover { border-color: #E6C384; background: rgba(230,195,132,0.14); color: #fff; }

    .lib-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; max-height: 170px; overflow-y: auto; }
    .lib-item {
      position: relative; aspect-ratio: 16/10; border-radius: 8px; overflow: hidden;
      border: 1.5px solid rgba(126,156,216,0.2); background: #0e121a; cursor: pointer;
    }
    .lib-item.active { border-color: #E6C384; box-shadow: 0 0 0 1px #E6C384; }
    .lib-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .lib-item .lib-fallback {
      width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
      font-size: 10px; color: #CFC8A3; padding: 4px; text-align: center; word-break: break-all;
    }
    .lib-del {
      position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; border-radius: 50%;
      border: none; background: rgba(11,15,23,0.78); color: #EAE6D3; font-size: 10px; cursor: pointer;
      display: none; align-items: center; justify-content: center;
    }
    .lib-item:hover .lib-del { display: flex; }
    .lib-del:hover { background: #E46876; }

    .pos-grid { display: grid; grid-template-columns: repeat(3, 28px); gap: 3px; }
    .pos-cell {
      width: 28px; height: 24px; border-radius: 5px; border: 1px solid rgba(126,156,216,0.24);
      background: rgba(11,15,23,0.7); color: #9c9888; cursor: pointer; font-size: 11px;
      display: flex; align-items: center; justify-content: center;
    }
    .pos-cell.active { background: rgba(230,195,132,0.28); border-color: #E6C384; color: #E6C384; }

    .color-item {
      display: flex; align-items: center; justify-content: space-between; gap: 5px;
      padding: 4px 6px; border-radius: 7px; background: rgba(11,15,23,0.55); border: 1px solid rgba(126,156,216,0.14);
      min-width: 0;
    }
    .color-item label { font-size: 11px; color: #CFC8A3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
    .color-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .color-hex-inp {
      width: 56px !important; padding: 2px 3px !important; border-radius: 4px !important;
      border: 1px solid transparent !important; background: transparent !important;
      font-family: Consolas, monospace !important; font-size: 10px !important; color: #8A8980 !important;
      text-align: right; text-transform: uppercase;
    }
    .color-hex-inp:focus { border-color: rgba(230,195,132,0.5) !important; background: rgba(11,15,23,0.9) !important; color: #EAE6D3 !important; }
    input[type="color"] {
      -webkit-appearance: none; appearance: none; width: 22px; height: 20px; border: none;
      background: transparent; padding: 0; cursor: pointer;
    }
    input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
    input[type="color"]::-webkit-color-swatch { border: 1px solid rgba(255,255,255,0.25); border-radius: 5px; }

    .av-card {
      display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px;
      background: rgba(11,15,23,0.55); border: 1px solid rgba(126,156,216,0.14);
    }
    .av-thumb {
      width: 30px; height: 30px; border-radius: 6px; flex-shrink: 0; overflow: hidden;
      border: 1px solid rgba(255,255,255,0.18); background: rgba(20,26,38,0.85);
      display: flex; align-items: center; justify-content: center; font-size: 11px; color: #9c9888;
    }
    .av-thumb img, .av-thumb svg { width: 100%; height: 100%; object-fit: cover; display: block; }
    .av-meta { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; }
    .av-label { font-size: 10.5px; color: #9c9888; }
    .av-val { font-size: 11px; color: #EAE6D3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .toggle {
      display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11.5px; color: #CFC8A3;
    }
    .toggle input { accent-color: #E6C384; cursor: pointer; }
  `;

  shadow.appendChild(el("style", { text: STUDIO_CSS }));

  // Trigger Pill
  const pill = el("button", { type: "button", class: "pill", title: "Mở Theme Studio (Ctrl+Alt+K)" }, ["🎨 Theme Studio"]);
  shadow.appendChild(pill);

  // Main Panel
  const panel = el("div", { class: "panel" });
  const titleBadge = el("span", { class: "badge", text: "kanagawa-wave" });
  const modeBadge = el("span", { class: "badge", text: "Dark" });
  const saveBtn = el("button", { type: "button", class: "icon-btn primary", text: "💾 Lưu" });
  const revertBtn = el("button", { type: "button", class: "icon-btn", text: "↺ Hoàn tác", title: "Hủy thay đổi chưa lưu" });
  const closeBtn = el("button", { type: "button", class: "icon-btn danger", text: "✕" });

  const header = el("div", { class: "header" }, [
    el("div", { class: "title-wrap" }, [
      el("span", { class: "title", text: "Theme Studio" }),
      titleBadge,
      modeBadge,
    ]),
    el("div", { class: "hbtns" }, [revertBtn, saveBtn, closeBtn]),
  ]);

  const TABS = [
    ["profiles", "🎭 Hồ sơ"],
    ["wallpaper", "🖼️ Hình nền"],
    ["surfaces", "🫧 Kính & Mờ"],
    ["colors", "🎨 Màu & Avatar"],
    ["advanced", "⚙️ Nâng cao"],
  ];
  const tabsBar = el("div", { class: "tabs" });
  const tabBtns = {};
  for (const [id, label] of TABS) {
    const b = el("button", {
      type: "button",
      class: "tab" + (state.activeTab === id ? " active" : ""),
      text: label,
      onClick: () => {
        state.activeTab = id;
        for (const [k, btn] of Object.entries(tabBtns)) btn.classList.toggle("active", k === id);
        if (id === "wallpaper" || id === "colors") void ensureLibraryThumbs();
        renderBody();
      },
    });
    tabBtns[id] = b;
    tabsBar.appendChild(b);
  }

  const body = el("div", { class: "body" });
  const statusSpan = el("span", { class: "status-ok", text: "Sẵn sàng (Ctrl+Alt+K)" });
  const shortcutHint = el("span", { text: "Phím tắt: Ctrl+Alt+K" });
  const footer = el("div", { class: "footer" }, [statusSpan, shortcutHint]);

  panel.appendChild(header);
  panel.appendChild(tabsBar);
  panel.appendChild(body);
  panel.appendChild(footer);
  shadow.appendChild(panel);
  (document.body || document.documentElement).appendChild(host);

  function setStatus(text, kind = "ok") {
    state.statusText = text;
    state.statusKind = kind;
    statusSpan.textContent = text;
    statusSpan.className = "status-" + kind;
  }

  function updateBadgesAndButtons() {
    const d = state.draft;
    if (d) {
      titleBadge.textContent = d.activeProfile || d.preset || "custom";
    }
    modeBadge.textContent = document.body && document.body.classList.contains("theme-light") ? "☀️ Light" : "🌙 Dark";
    const anyDirty = state.dirty || state.customCssDirty;
    saveBtn.classList.toggle("dirty", anyDirty);
    saveBtn.textContent = anyDirty ? "💾 Lưu*" : "💾 Lưu";
    revertBtn.style.display = anyDirty ? "inline-flex" : "none";
  }

  // --- Dragging Panel ---
  let dragging = false, dX = 0, dY = 0, pLeft = 0, pTop = 0, savedPos = null, dragPointerId = null;

  function applyPos(left, top) {
    const w = panel.offsetWidth || 436;
    const h = panel.offsetHeight || 500;
    const maxLeft = Math.max(8, window.innerWidth - w - 8);
    const maxTop = Math.max(8, window.innerHeight - h - 8);
    const cl = Math.max(8, Math.min(maxLeft, left));
    const ct = Math.max(8, Math.min(maxTop, top));
    panel.style.left = cl + "px";
    panel.style.top = ct + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    savedPos = { left: cl, top: ct };
  }

  function stopHeaderDrag() {
    if (!dragging) return;
    dragging = false;
    if (dragPointerId !== null) {
      try { header.releasePointerCapture(dragPointerId); } catch {}
      dragPointerId = null;
    }
  }

  header.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target && typeof e.target.closest === "function" && e.target.closest("button")) return;
    dragging = true;
    dragPointerId = e.pointerId;
    dX = e.clientX;
    dY = e.clientY;
    const r = panel.getBoundingClientRect();
    pLeft = r.left;
    pTop = r.top;
    try { header.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });

  const onPointerMove = (e) => {
    if (!dragging) return;
    applyPos(pLeft + (e.clientX - dX), pTop + (e.clientY - dY));
  };
  const onPointerUp = () => {
    stopHeaderDrag();
    endControlDrag();
  };
  const onPointerCancel = () => {
    stopHeaderDrag();
    endControlDrag();
  };
  const onWindowBlur = () => {
    stopHeaderDrag();
    endControlDrag();
  };
  const onWindowResize = () => {
    if (savedPos && panel.classList.contains("open")) applyPos(savedPos.left, savedPos.top);
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("resize", onWindowResize);

  // --- Open / Close / Hotkey ---
  async function openPanel() {
    panel.classList.add("open");
    host.style.zIndex = "2147483636";
    pill.classList.add("hidden");
    if (savedPos) applyPos(savedPos.left, savedPos.top);
    if (!state.config) {
      await refreshState();
    } else {
      renderAll();
      if (state.activeTab === "wallpaper" || state.activeTab === "colors") {
        void ensureLibraryThumbs();
      }
    }
  }

  function closePanel() {
    stopHeaderDrag();
    panel.classList.remove("open");
    host.style.zIndex = "2147483630";
    updatePillVisibility();
  }

  function updatePillVisibility() {
    const cfg = state.draft || state.config;
    const show = !cfg || !cfg.studio || cfg.studio.showTriggerPill !== false;
    pill.classList.toggle("hidden", !show || panel.classList.contains("open"));
    pill.classList.remove("pos-bottom-left", "pos-top-right");
    const pos = cfg && cfg.studio && cfg.studio.pillPosition;
    if (pos === "bottom-left") pill.classList.add("pos-bottom-left");
    else if (pos === "top-right") pill.classList.add("pos-top-right");
  }

  pill.addEventListener("click", openPanel);
  closeBtn.addEventListener("click", closePanel);
  saveBtn.addEventListener("click", () => { void saveAllPending(); });
  revertBtn.addEventListener("click", () => {
    if (!state.config) return;
    clearTimeout(saveDebounce);
    draftRevision++;
    syncDraftFromConfig(state.config);
    state.dirty = false;
    if (state.customCssDirty) {
      state.customCss = state.savedCustomCss;
      state.customCssDirty = false;
    }
    applyLivePreview(state.draft);
    renderAll();
    setStatus("Đã hoàn tác thay đổi", "ok");
  });

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === "k" || e.key === "K" || e.code === "KeyK")) {
      e.preventDefault();
      if (panel.classList.contains("open")) closePanel();
      else openPanel();
    } else if (e.key === "Escape" && panel.classList.contains("open")) {
      if (e.defaultPrevented) return;
      const openAppPopup = document.querySelector(
        '[data-mention-menu], #typeahead-menu:not(:empty), [role="listbox"]:not(:empty), [role="menu"]:not(:empty), [role="dialog"], [role="alertdialog"]'
      );
      if (openAppPopup) return;
      closePanel();
    }
  };
  window.addEventListener("keydown", onKeyDown);

  async function refreshState() {
    try {
      setStatus("Đang tải cấu hình...", "busy");
      const data = await sendCommand("get-state");
      applyReceivedState(data, { force: true });
      if (state.activeTab === "wallpaper" || state.activeTab === "colors") {
        void ensureLibraryThumbs();
      }
      setStatus("Đã đồng bộ", "ok");
    } catch (e) {
      setStatus("Lỗi kết nối: " + e.message, "err");
    }
  }

  let thumbsLoading = false;
  let thumbsNeedRecheck = false;
  async function ensureLibraryThumbs() {
    if (!state.library.length) return;
    if (thumbsLoading) {
      thumbsNeedRecheck = true;
      return;
    }
    const missing = state.library.filter(
      (x) => !state.thumbs[x.id] && state.thumbAttempted[x.id] !== x.mtimeMs
    );
    if (!missing.length) return;
    thumbsLoading = true;
    try {
      const batch = missing.slice(0, 80);
      const ids = batch.map((x) => x.id);
      const data = await sendCommand("get-library-thumbs", { ids });
      const returned = (data && data.thumbs) || {};
      for (const item of batch) {
        if (!returned[item.id]) {
          state.thumbAttempted[item.id] = item.mtimeMs;
        }
      }
      state.thumbs = { ...state.thumbs, ...returned };
      if ((state.activeTab === "wallpaper" || state.activeTab === "colors") && activeDragCount === 0) {
        renderBody();
      }
      if (missing.length > 80) thumbsNeedRecheck = true;
    } catch {} finally {
      thumbsLoading = false;
      if (thumbsNeedRecheck) {
        thumbsNeedRecheck = false;
        void ensureLibraryThumbs();
      }
    }
  }

  // --- Drag Tracking for Sliders / Color Pickers ---
  function beginControlDrag() {
    activeDragCount++;
  }
  function endControlDrag() {
    if (activeDragCount > 0) activeDragCount = 0;
    if (pendingDeferredRender) {
      pendingDeferredRender = false;
      renderAll();
    }
  }

  // --- Shared UI Controls ---
  function slider(label, value, min, max, step, unit, onInput) {
    const valSpan = el("span", { class: "slider-val", text: `${value}${unit}` });
    const inp = el("input", {
      type: "range", min, max, step, value,
      onPointerdown: beginControlDrag,
      onPointerup: endControlDrag,
      onBlur: endControlDrag,
      onInput: (e) => {
        const v = Number(e.target.value);
        valSpan.textContent = `${v}${unit}`;
        onInput(v, false);
      },
      onChange: (e) => {
        const v = Number(e.target.value);
        valSpan.textContent = `${v}${unit}`;
        endControlDrag();
        onInput(v, true);
      },
    });
    return el("div", { class: "slider-row" }, [
      el("div", { class: "slider-head" }, [el("span", { text: label }), valSpan]),
      inp,
    ]);
  }

  function colorPicker(label, hexValue, onChange) {
    const initialHex = normalizeHex(hexValue) || "#000000";
    const hexInp = el("input", {
      type: "text",
      class: "color-hex-inp",
      value: initialHex,
      maxlength: "7",
      title: "Nhập mã màu #RRGGBB",
      onInput: (e) => {
        const parsed = normalizeHex(e.target.value);
        if (parsed) {
          colorInp.value = parsed;
          onChange(parsed, false);
        }
      },
      onChange: (e) => {
        const parsed = normalizeHex(e.target.value);
        if (parsed) {
          e.target.value = parsed;
          colorInp.value = parsed;
          onChange(parsed, true);
        } else {
          e.target.value = colorInp.value.toUpperCase();
        }
      },
    });
    const colorInp = el("input", {
      type: "color",
      value: initialHex,
      onPointerdown: beginControlDrag,
      onBlur: endControlDrag,
      onInput: (e) => {
        const v = e.target.value.toUpperCase();
        hexInp.value = v;
        onChange(v, false);
      },
      onChange: (e) => {
        const v = e.target.value.toUpperCase();
        hexInp.value = v;
        endControlDrag();
        onChange(v, true);
      },
    });
    return el("div", { class: "color-item" }, [
      el("label", { text: label, title: label }),
      el("div", { class: "color-right" }, [hexInp, colorInp]),
    ]);
  }

  async function pickNativeImage(target) {
    if (pickingImage) return;
    pickingImage = true;
    try {
      setStatus("Đang mở hộp thoại chọn ảnh...", "busy");
      const data = await sendCommand("pick-image", { target, config: state.draft }, 0);
      if (data && data.canceled) {
        setStatus("Đã hủy chọn ảnh", "ok");
        return;
      }
      if (data) {
        draftRevision++;
        applyReceivedState(data, { force: true });
      }
      setStatus("Đã cập nhật ảnh!", "ok");
    } catch (e) {
      setStatus("Lỗi chọn ảnh: " + e.message, "err");
    } finally {
      pickingImage = false;
    }
  }

  async function uploadDroppedFile(file, target) {
    if (!file) return;
    const fileType = String(file.type || "").toLowerCase();
    const fileName = String(file.name || "drop.png");
    if (fileType ? !fileType.startsWith("image/") : !ALLOWED_IMAGE_EXT_RE.test(fileName)) {
      setStatus("Chỉ hỗ trợ file ảnh (.png, .jpg, .webp, .avif, .gif, .svg, .bmp)", "err");
      return;
    }
    if (!file.size) {
      setStatus("File ảnh rỗng hoặc không hợp lệ", "err");
      return;
    }
    if (file.size > MAX_DROP_FILE_BYTES) {
      setStatus("Ảnh vượt quá giới hạn 15 MB (" + (file.size / (1024 * 1024)).toFixed(1) + " MB)", "err");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setStatus("Không thể đọc file ảnh (thư mục hoặc file bị khóa)", "err");
    reader.onabort = () => setStatus("Đã hủy đọc file ảnh", "err");
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result || "");
        if (!dataUrl || !/^data:image\//i.test(dataUrl)) {
          setStatus("Dữ liệu file không phải ảnh hợp lệ", "err");
          return;
        }
        if (dataUrl.length > MAX_DATA_URL_CHARS) {
          setStatus("Ảnh sau mã hóa vượt quá giới hạn dung lượng (22 MB)", "err");
          return;
        }
        const chunkSize = Math.max(49152, Math.ceil(dataUrl.length / 400));
        const total = Math.max(1, Math.ceil(dataUrl.length / chunkSize));
        const uploadId = "up-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
        setStatus(`Đang tải ảnh (${Math.round(file.size / 1024)} KB)...`, "busy");
        let lastRes = null;
        for (let i = 0; i < total; i++) {
          if (total > 1) setStatus(`Đang tải ảnh (${i + 1}/${total})...`, "busy");
          const payload = {
            uploadId,
            filename: fileName,
            target,
            index: i,
            total,
            data: dataUrl.slice(i * chunkSize, (i + 1) * chunkSize),
          };
          if (i === 0 || i === total - 1) payload.config = state.draft;
          lastRes = await sendCommand("upload-chunk", payload);
        }
        if (lastRes && lastRes.complete !== false) {
          draftRevision++;
          applyReceivedState(lastRes, { force: true });
          setStatus("Đã áp dụng ảnh kéo-thả!", "ok");
        } else {
          setStatus("Tải ảnh chưa hoàn tất", "err");
        }
      } catch (e) {
        setStatus("Lỗi tải ảnh: " + e.message, "err");
      }
    };
    reader.readAsDataURL(file);
  }

  function formatAssetLabel(val) {
    if (!val || isNoneAsset(val)) return "Đã tắt";
    if (val === "SAME") return "Dùng chung Dark";
    if (val === "KEEP_EMBEDDED") return "Ảnh nhúng mặc định";
    if (val === "SVG_STAR") return "Sao 4 cánh SVG";
    if (String(val).startsWith("library:")) return String(val).slice("library:".length);
    return String(val);
  }

  function makeStarPreviewSvg(agentAv) {
    const ns = "http://www.w3.org/2000/svg";
    const bg = (agentAv && Array.isArray(agentAv.bgStops) && agentAv.bgStops.length >= 3)
      ? agentAv.bgStops : ["#FAF7E6", "#F6ECC9", "#EBE3CC"];
    const ic = (agentAv && Array.isArray(agentAv.iconStops) && agentAv.iconStops.length >= 3)
      ? agentAv.iconStops : ["#1F6E97", "#285C84", "#0E3252"];
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 36 36");
    const defs = document.createElementNS(ns, "defs");
    const g1 = document.createElementNS(ns, "linearGradient");
    g1.setAttribute("id", "knPreviewBg");
    g1.setAttribute("x1", "0%"); g1.setAttribute("y1", "0%"); g1.setAttribute("x2", "100%"); g1.setAttribute("y2", "100%");
    [["0%", bg[0]], ["55%", bg[1]], ["100%", bg[2]]].forEach(([off, col]) => {
      const s = document.createElementNS(ns, "stop");
      s.setAttribute("offset", off);
      s.setAttribute("stop-color", col);
      g1.appendChild(s);
    });
    const g2 = document.createElementNS(ns, "linearGradient");
    g2.setAttribute("id", "knPreviewIcon");
    g2.setAttribute("x1", "15%"); g2.setAttribute("y1", "15%"); g2.setAttribute("x2", "85%"); g2.setAttribute("y2", "85%");
    [["0%", ic[0]], ["52%", ic[1]], ["100%", ic[2]]].forEach(([off, col]) => {
      const s = document.createElementNS(ns, "stop");
      s.setAttribute("offset", off);
      s.setAttribute("stop-color", col);
      g2.appendChild(s);
    });
    defs.appendChild(g1);
    defs.appendChild(g2);
    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("width", "36");
    rect.setAttribute("height", "36");
    rect.setAttribute("fill", "url(#knPreviewBg)");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", "M18 5.5 C18.35 13.6 22.4 17.65 30.5 18 C22.4 18.35 18.35 22.4 18 30.5 C17.65 22.4 13.6 18.35 5.5 18 C13.6 17.65 17.65 13.6 18 5.5 Z");
    path.setAttribute("fill", "url(#knPreviewIcon)");
    svg.appendChild(defs);
    svg.appendChild(rect);
    svg.appendChild(path);
    return svg;
  }

  // --- Tab Renderers ---
  function renderProfilesTab(d) {
    const now = Date.now();
    const list = el("div", { class: "grid2" });
    for (const p of state.profiles) {
      const active = d.activeProfile === p.id;
      const card = el("div", {
        class: "profile-card" + (active ? " active" : ""),
        onClick: async () => {
          try {
            setStatus(`Đang chuyển sang "${p.name}"...`, "busy");
            const data = await sendCommand("load-profile", { profileId: p.id });
            draftRevision++;
            applyReceivedState(data, { force: true });
            setStatus(`Đã bật hồ sơ "${p.name}"`, "ok");
          } catch (e) {
            setStatus("Lỗi tải hồ sơ: " + e.message, "err");
          }
        },
      }, [
        el("div", { class: "pname", text: (active ? "✓ " : "") + p.name }),
        el("div", { class: "pdesc", text: p.description || (p.wallpaper === "NONE" ? "Nền trơn" : "Có hình nền") }),
        el("div", { class: "swatches" }, (p.swatch || []).map((c) => el("span", { class: "dot", style: { background: c } }))),
      ]);
      if (!p.builtIn) {
        const isConfirming = state.confirmDeleteProfileId === p.id && state.confirmDeleteProfileUntil > now;
        card.appendChild(el("button", {
          type: "button",
          class: "pdel" + (isConfirming ? " confirming" : ""),
          text: isConfirming ? "Xóa?" : "✕",
          title: isConfirming ? "Bấm lần nữa để xác nhận xóa" : "Xóa hồ sơ",
          onClick: async (e) => {
            e.stopPropagation();
            if (state.confirmDeleteProfileId !== p.id || Date.now() > state.confirmDeleteProfileUntil) {
              state.confirmDeleteProfileId = p.id;
              state.confirmDeleteProfileUntil = Date.now() + 3500;
              renderBody();
              setStatus(`Bấm lại nút Xóa để xóa "${p.name}"`, "busy");
              return;
            }
            state.confirmDeleteProfileId = "";
            state.confirmDeleteProfileUntil = 0;
            try {
              const data = await sendCommand("delete-profile", { profileId: p.id });
              applyReceivedState(data, { force: !state.dirty });
              setStatus(`Đã xóa hồ sơ "${p.name}"`, "ok");
            } catch (err) {
              setStatus("Lỗi xóa hồ sơ: " + err.message, "err");
            }
          },
        }));
      }
      list.appendChild(card);
    }

    const nameInput = el("input", {
      type: "text",
      value: state.newProfileName || "",
      placeholder: "Tên hồ sơ mới (vd: Anime Glass)...",
      onInput: (e) => { state.newProfileName = e.target.value; },
    });
    const saveNewBtn = el("button", {
      type: "button", class: "btn accent", text: "+ Lưu thành hồ sơ mới",
      onClick: async () => {
        const name = nameInput.value.trim();
        if (!name) { setStatus("Hãy nhập tên hồ sơ trước", "err"); return; }
        const slugAttempt = name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
        const builtInCollision = state.profiles.find(
          (p) => p.builtIn && (p.id === slugAttempt || String(p.name || "").toLowerCase() === name.toLowerCase())
        );
        if (builtInCollision) {
          setStatus(`Tên trùng hồ sơ mặc định "${builtInCollision.name}" — hãy đặt tên khác`, "err");
          return;
        }
        try {
          setStatus(`Đang lưu hồ sơ "${name}"...`, "busy");
          const data = await sendCommand("save-profile", { name, config: d });
          state.newProfileName = "";
          nameInput.value = "";
          draftRevision++;
          applyReceivedState(data, { force: true });
          setStatus(`Đã lưu hồ sơ "${name}"`, "ok");
        } catch (e) {
          setStatus("Lỗi lưu hồ sơ: " + e.message, "err");
        }
      },
    });

    const curMeta = d.activeProfile ? state.profiles.find((x) => x.id === d.activeProfile) : null;
    const canUpdateCurrent = Boolean(curMeta);
    const updateCurBtn = el("button", {
      type: "button",
      class: "btn gold",
      disabled: !canUpdateCurrent,
      text: canUpdateCurrent ? "⟳ Cập nhật hồ sơ hiện tại" : "⟳ Chưa chọn hồ sơ",
      title: canUpdateCurrent ? `Cập nhật "${curMeta.name}"` : "Hãy chọn hoặc tạo hồ sơ trước",
      onClick: async () => {
        if (!curMeta) {
          setStatus("Không có hồ sơ đang chọn — hãy dùng 'Lưu thành hồ sơ mới'", "err");
          return;
        }
        try {
          setStatus(`Đang cập nhật "${curMeta.name}"...`, "busy");
          const data = await sendCommand("save-profile", {
            profileId: curMeta.id,
            name: curMeta.name,
            builtIn: Boolean(curMeta.builtIn),
            config: d,
          });
          draftRevision++;
          applyReceivedState(data, { force: true });
          setStatus(`Đã cập nhật "${curMeta.name}"`, "ok");
        } catch (e) {
          setStatus("Lỗi cập nhật hồ sơ: " + e.message, "err");
        }
      },
    });

    const exportBtn = el("button", {
      type: "button", class: "btn sm", text: "📋 Copy JSON hồ sơ",
      onClick: () => {
        navigator.clipboard.writeText(JSON.stringify(d, null, 2))
          .then(() => setStatus("Đã copy JSON cấu hình!", "ok"))
          .catch((e) => setStatus("Không thể copy clipboard: " + e.message, "err"));
      },
    });
    const importBtn = el("button", {
      type: "button", class: "btn sm", text: "📥 Dán JSON từ Clipboard",
      onClick: async () => {
        try {
          const txt = await navigator.clipboard.readText();
          const parsed = JSON.parse(txt);
          if (!isPlainObject(parsed)) throw new Error("Not an object");
          const candidate = isPlainObject(parsed.config) ? parsed.config : parsed;
          const knownKeys = ["schemaVersion", "preset", "wallpaper", "wallpaperEffects", "surfaces", "avatars", "composer", "typography", "dark", "light", "loading", "studio"];
          if (!knownKeys.some((k) => k in candidate)) {
            setStatus("JSON không đúng định dạng cấu hình Kanagawa Studio", "err");
            return;
          }
          state.draft = mergeImportedConfig(state.draft, candidate);
          commitDraft({ isCommit: true, forceDisk: true });
          renderBody();
          setStatus("Đã nhập JSON cấu hình!", "ok");
        } catch (e) {
          setStatus("Clipboard không phải JSON cấu hình hợp lệ", "err");
        }
      },
    });

    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title" }, ["Chuyển nhanh 1 click", el("span", { text: `${state.profiles.length} hồ sơ` })]),
      list,
    ]));
    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title", text: "Lưu & Chia sẻ Combo" }),
      nameInput,
      el("div", { class: "grid2" }, [saveNewBtn, updateCurBtn]),
      el("div", { class: "grid2" }, [exportBtn, importBtn]),
    ]));
  }

  function renderWallpaperTab(d) {
    const isLightTab = state.wpModeTab === "light";
    const seg = el("div", { class: "seg" }, [
      el("button", {
        type: "button", class: !isLightTab ? "active" : "", text: "🌙 Dark Mode (Chính)",
        onClick: () => { state.wpModeTab = "dark"; renderBody(); },
      }),
      el("button", {
        type: "button", class: isLightTab ? "active" : "", text: "☀️ Light Mode (Riêng)",
        onClick: () => { state.wpModeTab = "light"; renderBody(); },
      }),
    ]);

    const targetField = isLightTab ? "wallpaperLight" : "wallpaper";
    const currentVal = d[targetField];

    const dropzone = el("div", {
      class: "dropzone",
      text: "📂 Kéo thả ảnh (.png, .jpg, .webp, .avif, .gif) ≤15MB vào đây hoặc bấm để chọn",
      onClick: () => pickNativeImage(targetField),
    });
    dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) void uploadDroppedFile(file, targetField);
    });

    const wpBtns = [
      el("button", { type: "button", class: "btn accent", text: "📁 Chọn ảnh", onClick: () => pickNativeImage(targetField) }),
      el("button", {
        type: "button", class: "btn" + (currentVal === "NONE" ? " active" : ""), text: "🚫 Tắt hình nền",
        onClick: () => { d[targetField] = "NONE"; commitDraft({ isCommit: true, forceDisk: true }); renderBody(); },
      }),
    ];
    if (isLightTab) {
      wpBtns.push(el("button", {
        type: "button", class: "btn" + (currentVal === "SAME" ? " active" : ""), text: "🔗 Dùng chung Dark",
        onClick: () => { d.wallpaperLight = "SAME"; commitDraft({ isCommit: true, forceDisk: true }); renderBody(); },
      }));
    }

    // Library Grid
    const libGrid = el("div", { class: "lib-grid" });
    if (!state.library.length) {
      libGrid.appendChild(el("div", { style: { gridColumn: "1 / -1", color: "#8A8980", textAlign: "center", padding: "8px" }, text: "Chưa có ảnh nào trong thư viện." }));
    } else {
      for (const item of state.library) {
        const thumbUrl = state.thumbs[item.id];
        const card = el("div", {
          class: "lib-item" + (currentVal === item.id ? " active" : ""),
          title: `${item.filename} (${Math.round(item.size / 1024)} KB)`,
          onClick: () => {
            d[targetField] = item.id;
            commitDraft({ isCommit: true, forceDisk: true });
            renderBody();
          },
        }, [
          thumbUrl
            ? el("img", { src: thumbUrl, alt: item.filename })
            : el("div", { class: "lib-fallback", text: item.filename }),
          el("button", {
            type: "button", class: "lib-del", text: "✕", title: "Xóa khỏi thư viện",
            onClick: async (e) => {
              e.stopPropagation();
              try {
                const data = await sendCommand("delete-library-asset", { assetId: item.id, config: state.draft });
                draftRevision++;
                applyReceivedState(data, { force: true });
                setStatus("Đã xóa ảnh khỏi thư viện", "ok");
              } catch (err) {
                setStatus("Lỗi xóa ảnh: " + err.message, "err");
              }
            },
          }),
        ]);
        libGrid.appendChild(card);
      }
    }

    // Position & Fit
    const posKey = isLightTab ? "wallpaperPositionLight" : "wallpaperPosition";
    const isPosSame = isLightTab && (!d.wallpaperPositionLight || d.wallpaperPositionLight === "SAME");
    const curPos = isPosSame ? d.wallpaperPosition : d[posKey];
    const posGrid = el("div", { class: "pos-grid" }, POS_GRID.map(([val, icon]) =>
      el("button", {
        type: "button",
        class: "pos-cell" + (curPos === val ? " active" : ""),
        text: icon,
        title: val,
        onClick: () => {
          d[posKey] = val;
          commitDraft(true);
          renderBody();
        },
      })
    ));

    const posColChildren = [
      el("span", { style: { fontSize: "11px", color: "#CFC8A3" }, text: isLightTab ? "Vị trí Light" : "Vị trí" }),
      posGrid,
    ];
    if (isLightTab) {
      posColChildren.push(el("button", {
        type: "button",
        class: "btn sm" + (isPosSame ? " active" : ""),
        text: "🔗 Theo Dark",
        style: { marginTop: "3px", width: "90px" },
        onClick: () => {
          d.wallpaperPositionLight = "SAME";
          commitDraft(true);
          renderBody();
        },
      }));
    }

    const fitSelect = el("select", {
      onChange: (e) => { d.wallpaperFit = e.target.value; commitDraft(true); },
    }, [
      el("option", { value: "cover", text: "Cover (Phủ kín, giữ tỉ lệ)" }),
      el("option", { value: "contain", text: "Contain (Hiện toàn bộ ảnh)" }),
      el("option", { value: "100% 100%", text: "Stretch (Kéo giãn vừa màn hình)" }),
      el("option", { value: "auto", text: "Auto (Kích thước gốc)" }),
    ]);
    fitSelect.value = d.wallpaperFit || "cover";

    const fx = d.wallpaperEffects;
    const scrimSel = el("select", {
      onChange: (e) => { fx.scrimStyle = e.target.value; commitDraft(true); },
    }, [
      el("option", { value: "directional", text: "Sáng góc phải (Kanagawa)" }),
      el("option", { value: "gradient", text: "Chuyển sắc dọc (Gradient)" }),
      el("option", { value: "solid", text: "Tối đều toàn màn hình (Solid)" }),
      el("option", { value: "vignette", text: "Tối viền (Vignette)" }),
      el("option", { value: "none", text: "Không phủ tối" }),
    ]);
    const normalizedScrim = fx.scrimStyle === "uniform" ? "solid" : (fx.scrimStyle || "directional");
    scrimSel.value = normalizedScrim;

    body.appendChild(el("div", { class: "sec" }, [
      seg,
      el("div", { class: "row" }, [
        el("span", { class: "hint", text: isLightTab ? "Đang dùng (Light):" : "Đang dùng (Dark):" }),
        el("span", { class: "badge", text: formatAssetLabel(currentVal), style: { maxWidth: "240px" } }),
      ]),
      dropzone,
      el("div", { class: isLightTab ? "grid3" : "grid2" }, wpBtns),
    ]));

    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title" }, ["Thư viện ảnh nhanh", el("span", { text: `${state.library.length} ảnh` })]),
      libGrid,
    ]));

    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title" }, [
        "Canh vị trí & Hiệu ứng",
        el("span", { class: "hint", text: "Hiệu ứng áp dụng chung Dark & Light" }),
      ]),
      el("div", { class: "row", style: { alignItems: "flex-start" } }, [
        el("div", { class: "col" }, posColChildren),
        el("div", { class: "col", style: { flex: "1" } }, [
          el("span", { style: { fontSize: "11px", color: "#CFC8A3" }, text: "Kiểu hiển thị (Fit)" }),
          fitSelect,
          el("span", { style: { fontSize: "11px", color: "#CFC8A3", marginTop: "4px" }, text: "Kiểu lớp phủ tối (Scrim)" }),
          scrimSel,
        ]),
      ]),
      slider("Độ mờ nền (Blur)", fx.blur, 0, 40, 1, "px", (v, done) => { fx.blur = v; commitDraft(done); }),
      slider("Độ sáng (Brightness)", fx.brightness, 20, 200, 2, "%", (v, done) => { fx.brightness = v; commitDraft(done); }),
      slider("Độ tương phản (Contrast)", fx.contrast, 30, 200, 2, "%", (v, done) => { fx.contrast = v; commitDraft(done); }),
      slider("Bão hòa màu (Saturate)", fx.saturate, 0, 250, 5, "%", (v, done) => { fx.saturate = v; commitDraft(done); }),
      slider("Độ rõ ảnh nền (Opacity)", fx.opacity, 0, 100, 2, "%", (v, done) => { fx.opacity = v; commitDraft(done); }),
      slider("Phóng to (Scale)", fx.scale, 100, 200, 1, "%", (v, done) => { fx.scale = v; commitDraft(done); }),
      slider("Độ tối lớp phủ đọc chữ (Scrim)", fx.scrimOpacity, 0, 100, 2, "%", (v, done) => { fx.scrimOpacity = v; commitDraft(done); }),
    ]));
  }

  function renderSurfacesTab(d) {
    const sf = d.surfaces;
    const isPresetActive = (qp) => Object.entries(qp.surfaces).every(([k, v]) => Number(sf[k]) === Number(v));

    const quickRow = el("div", { class: "grid2" }, SURFACE_QUICK_PRESETS.map((qp) =>
      el("button", {
        type: "button",
        class: "btn sm" + (isPresetActive(qp) ? " active" : ""),
        text: qp.name,
        onClick: () => {
          d.surfaces = { ...d.surfaces, ...qp.surfaces };
          commitDraft(true);
          renderBody();
        },
      })
    ));

    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title", text: "Kiểu bề mặt nhanh" }),
      quickRow,
    ]));

    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title", text: "Hiệu ứng Kính mờ (Glassmorphism)" }),
      slider("Độ mờ kính nền (Glass Blur)", sf.glassBlur, 0, 32, 1, "px", (v, done) => { sf.glassBlur = v; commitDraft(done); }),
      slider("Độ rực màu kính (Saturate)", sf.glassSaturate, 80, 220, 5, "%", (v, done) => { sf.glassSaturate = v; commitDraft(done); }),
    ]));

    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title", text: "Độ mờ đục từng khu vực (Opacity)" }),
      slider("Sidebar trái", sf.sidebarOpacity, 0, 100, 2, "%", (v, done) => { sf.sidebarOpacity = v; commitDraft(done); }),
      slider("Khung nền chính & Side Panel", sf.panelOpacity, 0, 100, 2, "%", (v, done) => { sf.panelOpacity = v; commitDraft(done); }),
      slider("Khung tin nhắn AI", sf.chatOpacity, 0, 100, 2, "%", (v, done) => { sf.chatOpacity = v; commitDraft(done); }),
      slider("Bong bóng tin nhắn User", sf.userBubbleOpacity, 0, 100, 2, "%", (v, done) => { sf.userBubbleOpacity = v; commitDraft(done); }),
      slider("Khung nhập Chat (Composer)", sf.composerOpacity, 0, 100, 2, "%", (v, done) => { sf.composerOpacity = v; commitDraft(done); }),
      slider("Khối Code Block", sf.codeOpacity, 0, 100, 2, "%", (v, done) => { sf.codeOpacity = v; commitDraft(done); }),
      slider("Trình sửa Code (Monaco) & Terminal", sf.editorOpacity, 0, 100, 2, "%", (v, done) => { sf.editorOpacity = v; commitDraft(done); }),
      slider("Thanh tiêu đề (Titlebar)", sf.titlebarOpacity, 0, 100, 2, "%", (v, done) => { sf.titlebarOpacity = v; commitDraft(done); }),
      slider("Popup / Menu / Dialog", sf.overlayOpacity, 45, 100, 1, "%", (v, done) => { sf.overlayOpacity = v; commitDraft(done); }),
    ]));

    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title", text: "Bo góc (Border Radius)" }),
      slider("Bo góc Panel lớn", sf.panelRadius, 0, 32, 1, "px", (v, done) => { sf.panelRadius = v; commitDraft(done); }),
      slider("Bo góc Card & Tin nhắn AI", sf.cardRadius, 0, 32, 1, "px", (v, done) => { sf.cardRadius = v; commitDraft(done); }),
      slider("Bo góc Khung nhập Composer", sf.composerRadius, 0, 32, 1, "px", (v, done) => { sf.composerRadius = v; commitDraft(done); }),
      slider("Bo góc Bong bóng User", sf.bubbleRadius, 0, 32, 1, "px", (v, done) => { sf.bubbleRadius = v; commitDraft(done); }),
    ]));
  }

  function renderColorsTab(d) {
    // 1. Quick Palette Presets (keeps current wallpaper & opacity)
    const presetRow = el("div", { class: "grid2" }, Object.entries(PRESET_SWATCHES).map(([id, p]) =>
      el("button", {
        type: "button",
        class: "btn sm" + (d.preset === id ? " active" : ""),
        onClick: async () => {
          try {
            setStatus(`Đang đổi bảng màu ${p.label}...`, "busy");
            const res = await sendCommand("apply-preset-colors", { presetId: id, config: d });
            draftRevision++;
            applyReceivedState(res, { force: true });
            setStatus(`Đã đổi bảng màu ${p.label}`, "ok");
          } catch (e) {
            setStatus("Lỗi đổi preset: " + e.message, "err");
          }
        },
      }, [
        el("span", { class: "dot", style: { background: p.colors[1], width: "10px", height: "10px" } }),
        p.label,
      ])
    ));

    // 2. Color pickers (Dark vs Light)
    const isLightC = state.colorModeTab === "light";
    const cSeg = el("div", { class: "seg" }, [
      el("button", { type: "button", class: !isLightC ? "active" : "", text: "🌙 Bảng màu Dark", onClick: () => { state.colorModeTab = "dark"; renderBody(); } }),
      el("button", { type: "button", class: isLightC ? "active" : "", text: "☀️ Bảng màu Light", onClick: () => { state.colorModeTab = "light"; renderBody(); } }),
    ]);

    const colorKeys = isLightC
      ? [
          ["chromeBg", "Nền Chrome"], ["chromeFg", "Chữ Chrome"], ["primary", "Nhấn chính"], ["text", "Chữ chính"],
          ["textMuted", "Chữ phụ"], ["surfaceBase", "Nền Card"], ["sidebarBase", "Nền Sidebar"], ["overlayBase", "Nền Popup"],
          ["scrimBase", "Màu phủ Scrim"], ["paper0", "Paper 0"], ["paper1", "Paper 1"], ["paper2", "Paper 2"], ["paper3", "Paper 3"],
        ]
      : [
          ["chromeBg", "Nền Chrome"], ["chromeFg", "Chữ Chrome"], ["primary", "Nhấn chính"], ["accentBlue", "Xanh Blue"],
          ["accentAqua", "Ngọc Aqua"], ["accentGreen", "Xanh lá"], ["accentPink", "Hồng Pink"], ["accentViolet", "Tím Violet"],
          ["accentOrange", "Cam Orange"], ["text", "Chữ chính"], ["textMuted", "Chữ phụ"], ["textSubtle", "Chữ mờ"],
          ["surfaceBase", "Nền Card"], ["sidebarBase", "Nền Sidebar"], ["overlayBase", "Nền Popup"], ["scrimBase", "Màu phủ Scrim"],
          ["selection", "Vùng chọn"],
        ];

    const palGrid = el("div", { class: "grid2" }, colorKeys.map(([key, label]) =>
      colorPicker(label, d[state.colorModeTab][key], (val, done) => {
        d[state.colorModeTab][key] = val;
        commitDraft(done);
      })
    ));

    // 3. Composer & User Bubble Gradients (Dark Mode)
    const comp = d.composer;
    const compGrid = el("div", { class: "grid2" }, [
      colorPicker("Viền Composer 1", comp.rimStart, (v, done) => { comp.rimStart = v; commitDraft(done); }),
      colorPicker("Viền Composer 2", comp.rimMid, (v, done) => { comp.rimMid = v; commitDraft(done); }),
      colorPicker("Viền Composer 3", comp.rimEnd, (v, done) => { comp.rimEnd = v; commitDraft(done); }),
      colorPicker("Nền Composer 1", comp.innerStart, (v, done) => { comp.innerStart = v; commitDraft(done); }),
      colorPicker("Nền Composer 2", comp.innerMid, (v, done) => { comp.innerMid = v; commitDraft(done); }),
      colorPicker("Nền Composer 3", comp.innerEnd, (v, done) => { comp.innerEnd = v; commitDraft(done); }),
      colorPicker("Bong bóng User 1", comp.userBubbleStart, (v, done) => { comp.userBubbleStart = v; commitDraft(done); }),
      colorPicker("Bong bóng User 2", comp.userBubbleEnd, (v, done) => { comp.userBubbleEnd = v; commitDraft(done); }),
      colorPicker("Viền Bong bóng", comp.userBubbleBorder, (v, done) => { comp.userBubbleBorder = v; commitDraft(done); }),
    ]);

    // 4. Avatars
    const av = d.avatars;
    const userAvSpec = String(d.userAvatar || "");
    const agentAvSpec = String((d.agentAvatar && d.agentAvatar.image) || "");
    const userIsNone = isNoneAsset(userAvSpec);
    const agentIsNone = isNoneAsset(agentAvSpec);

    const makeAvPreview = (spec, isAgent) => {
      const box = el("div", { class: "av-thumb" });
      if (isNoneAsset(spec)) {
        box.textContent = "—";
      } else if (isAgent && spec === "SVG_STAR") {
        box.appendChild(makeStarPreviewSvg(d.agentAvatar));
      } else if (state.thumbs[spec]) {
        box.appendChild(el("img", { src: state.thumbs[spec], alt: "avatar" }));
      } else {
        box.textContent = spec === "KEEP_EMBEDDED" ? "🖼️" : "✦";
      }
      return box;
    };

    const userAvToggle = el("label", { class: "toggle" }, [
      el("input", {
        type: "checkbox",
        ...(av.userVisible !== false && !userIsNone ? { checked: "checked" } : {}),
        onChange: (e) => {
          if (e.target.checked && userIsNone) {
            e.target.checked = false;
            setStatus("Chưa có ảnh Avatar User — hãy bấm 'Đổi Avatar User'", "err");
            return;
          }
          av.userVisible = e.target.checked;
          commitDraft(true);
        },
      }),
      "Hiện Avatar User",
    ]);
    const agentAvToggle = el("label", { class: "toggle" }, [
      el("input", {
        type: "checkbox",
        ...(av.agentVisible !== false && !agentIsNone ? { checked: "checked" } : {}),
        onChange: (e) => {
          if (e.target.checked && agentIsNone) {
            d.agentAvatar = d.agentAvatar || {};
            d.agentAvatar.image = "SVG_STAR";
            av.agentVisible = true;
            commitDraft({ isCommit: true, forceDisk: true });
            renderBody();
            return;
          }
          av.agentVisible = e.target.checked;
          commitDraft(true);
        },
      }),
      "Hiện Avatar Agent",
    ]);

    const userAvThumbBox = makeAvPreview(userAvSpec, false);
    const agentAvThumbBox = makeAvPreview(agentAvSpec, true);
    const refreshAgentStarThumb = () => {
      if (agentAvSpec !== "SVG_STAR") return;
      while (agentAvThumbBox.firstChild) agentAvThumbBox.removeChild(agentAvThumbBox.firstChild);
      agentAvThumbBox.appendChild(makeStarPreviewSvg(d.agentAvatar));
    };

    const avChildren = [
      el("div", { class: "sec-title", text: "Tùy chỉnh Avatar User & Agent" }),
      el("div", { class: "grid2" }, [
        el("div", { class: "av-card" }, [
          userAvThumbBox,
          el("div", { class: "av-meta" }, [
            el("span", { class: "av-label", text: "Avatar User" }),
            el("span", { class: "av-val", text: formatAssetLabel(userAvSpec), title: userAvSpec }),
          ]),
        ]),
        el("div", { class: "av-card" }, [
          agentAvThumbBox,
          el("div", { class: "av-meta" }, [
            el("span", { class: "av-label", text: "Avatar Agent" }),
            el("span", { class: "av-val", text: formatAssetLabel(agentAvSpec), title: agentAvSpec }),
          ]),
        ]),
      ]),
      el("div", { class: "row" }, [userAvToggle, agentAvToggle]),
      el("div", { class: "grid2" }, [
        el("button", { type: "button", class: "btn accent sm", text: "🖼️ Đổi Avatar User", onClick: () => pickNativeImage("userAvatar") }),
        el("button", { type: "button", class: "btn accent sm", text: "🖼️ Đổi Avatar Agent", onClick: () => pickNativeImage("agentAvatar") }),
      ]),
      el("div", { class: "grid2" }, [
        el("button", {
          type: "button", class: "btn sm" + (userIsNone ? " active" : ""), text: "🚫 Tắt ảnh User",
          onClick: () => {
            d.userAvatar = "NONE";
            av.userVisible = false;
            commitDraft({ isCommit: true, forceDisk: true });
            renderBody();
          },
        }),
        el("button", {
          type: "button", class: "btn sm" + (agentIsNone ? " active" : ""), text: "🚫 Tắt ảnh Agent",
          onClick: () => {
            d.agentAvatar = d.agentAvatar || {};
            d.agentAvatar.image = "NONE";
            av.agentVisible = false;
            commitDraft({ isCommit: true, forceDisk: true });
            renderBody();
          },
        }),
      ]),
      el("div", { class: "grid2" }, [
        el("button", {
          type: "button", class: "btn sm" + (agentAvSpec === "SVG_STAR" ? " active" : ""), text: "✦ Agent: Sao 4 cánh SVG",
          onClick: () => {
            d.agentAvatar = d.agentAvatar || {};
            d.agentAvatar.image = "SVG_STAR";
            av.agentVisible = true;
            commitDraft({ isCommit: true, forceDisk: true });
            renderBody();
          },
        }),
        el("button", {
          type: "button", class: "btn sm", text: "📐 Xoay 0° (Thẳng cả 2)",
          onClick: () => { av.userRotate = 0; av.agentRotate = 0; commitDraft(true); renderBody(); },
        }),
      ]),
    ];

    if (agentAvSpec === "SVG_STAR") {
      d.agentAvatar.bgStops = Array.isArray(d.agentAvatar.bgStops) && d.agentAvatar.bgStops.length >= 3
        ? d.agentAvatar.bgStops : ["#FAF7E6", "#F6ECC9", "#EBE3CC"];
      d.agentAvatar.iconStops = Array.isArray(d.agentAvatar.iconStops) && d.agentAvatar.iconStops.length >= 3
        ? d.agentAvatar.iconStops : ["#1F6E97", "#285C84", "#0E3252"];
      avChildren.push(
        el("div", { class: "hint", text: "Màu Sao 4 cánh SVG (hiển thị live ngay khi kéo):" }),
        el("div", { class: "grid2" }, [
          colorPicker("Nền Sao 1", d.agentAvatar.bgStops[0], (v, done) => { d.agentAvatar.bgStops[0] = v; refreshAgentStarThumb(); commitDraft({ isCommit: done, forceDisk: done && state.autoSave }); }),
          colorPicker("Nền Sao 2", d.agentAvatar.bgStops[1], (v, done) => { d.agentAvatar.bgStops[1] = v; refreshAgentStarThumb(); commitDraft({ isCommit: done, forceDisk: done && state.autoSave }); }),
          colorPicker("Nền Sao 3", d.agentAvatar.bgStops[2], (v, done) => { d.agentAvatar.bgStops[2] = v; refreshAgentStarThumb(); commitDraft({ isCommit: done, forceDisk: done && state.autoSave }); }),
          colorPicker("Sao 1", d.agentAvatar.iconStops[0], (v, done) => { d.agentAvatar.iconStops[0] = v; refreshAgentStarThumb(); commitDraft({ isCommit: done, forceDisk: done && state.autoSave }); }),
          colorPicker("Sao 2", d.agentAvatar.iconStops[1], (v, done) => { d.agentAvatar.iconStops[1] = v; refreshAgentStarThumb(); commitDraft({ isCommit: done, forceDisk: done && state.autoSave }); }),
          colorPicker("Sao 3", d.agentAvatar.iconStops[2], (v, done) => { d.agentAvatar.iconStops[2] = v; refreshAgentStarThumb(); commitDraft({ isCommit: done, forceDisk: done && state.autoSave }); }),
        ])
      );
    }

    avChildren.push(
      slider("Kích thước Avatar User", av.userSize, 18, 64, 1, "px", (v, done) => { av.userSize = v; commitDraft(done); }),
      slider("Bo góc Avatar User (50% = Tròn)", av.userRadius, 0, 50, 1, "%", (v, done) => { av.userRadius = v; commitDraft(done); }),
      slider("Góc nghiêng Avatar User", av.userRotate, -45, 45, 1, "°", (v, done) => { av.userRotate = v; commitDraft(done); }),
      slider("Kích thước Avatar Agent", av.agentSize, 18, 64, 1, "px", (v, done) => { av.agentSize = v; commitDraft(done); }),
      slider("Bo góc Avatar Agent (50% = Tròn)", av.agentRadius, 0, 50, 1, "%", (v, done) => { av.agentRadius = v; commitDraft(done); }),
      slider("Góc nghiêng Avatar Agent", av.agentRotate, -45, 45, 1, "°", (v, done) => { av.agentRotate = v; commitDraft(done); })
    );

    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title", text: "Bảng màu nhanh (Giữ nguyên hình nền)" }),
      presetRow,
    ]));

    body.appendChild(el("div", { class: "sec" }, [
      cSeg,
      palGrid,
    ]));

    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title" }, [
        "Gradient Khung nhập & Bong bóng User",
        el("span", { class: "hint", text: "Áp dụng Dark Mode" }),
      ]),
      compGrid,
    ]));

    body.appendChild(el("div", { class: "sec" }, avChildren));
  }

  function renderAdvancedTab(d) {
    const typo = d.typography;
    const ld = d.loading;
    const st = d.studio || {};

    const uiFontInp = el("input", {
      type: "text",
      value: typo.uiFont || "",
      placeholder: "Hoặc nhập tên font cài trên máy...",
      onInput: (e) => {
        typo.uiFont = e.target.value;
        uiFontSel.value = UI_FONTS.includes(typo.uiFont) ? typo.uiFont : "";
        commitDraft(false);
      },
      onChange: (e) => { typo.uiFont = e.target.value; commitDraft(true); },
    });
    const uiFontSel = el("select", {
      onChange: (e) => {
        typo.uiFont = e.target.value;
        uiFontInp.value = e.target.value;
        commitDraft(true);
      },
    }, UI_FONTS.map((f) => el("option", { value: f, text: f || "Mặc định / Tùy chỉnh" })));
    uiFontSel.value = UI_FONTS.includes(typo.uiFont) ? typo.uiFont : "";

    const monoFontInp = el("input", {
      type: "text",
      value: typo.monoFont || "",
      placeholder: "Hoặc nhập tên mono font...",
      onInput: (e) => {
        typo.monoFont = e.target.value;
        monoFontSel.value = MONO_FONTS.includes(typo.monoFont) ? typo.monoFont : "";
        commitDraft(false);
      },
      onChange: (e) => { typo.monoFont = e.target.value; commitDraft(true); },
    });
    const monoFontSel = el("select", {
      onChange: (e) => {
        typo.monoFont = e.target.value;
        monoFontInp.value = e.target.value;
        commitDraft(true);
      },
    }, MONO_FONTS.map((f) => el("option", { value: f, text: f || "Mặc định / Tùy chỉnh" })));
    monoFontSel.value = MONO_FONTS.includes(typo.monoFont) ? typo.monoFont : "";

    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title", text: "Kiểu chữ & Cỡ chữ (Typography)" }),
      el("div", { class: "grid2" }, [
        el("div", { class: "col" }, [el("span", { style: { fontSize: "11px", color: "#CFC8A3" }, text: "Font giao diện" }), uiFontSel, uiFontInp]),
        el("div", { class: "col" }, [el("span", { style: { fontSize: "11px", color: "#CFC8A3" }, text: "Font Code" }), monoFontSel, monoFontInp]),
      ]),
      slider("Cỡ chữ Chat (0 = Mặc định)", typo.chatFontSize, 0, 26, 1, "px", (v, done) => { typo.chatFontSize = v; commitDraft(done); }),
      slider("Cỡ chữ Code (0 = Mặc định)", typo.codeFontSize, 0, 24, 1, "px", (v, done) => { typo.codeFontSize = v; commitDraft(done); }),
      slider("Giãn dòng Chat (Line Height)", typo.lineHeight, 1.15, 2.2, 0.02, "", (v, done) => { typo.lineHeight = v; commitDraft(done); }),
    ]));

    // Loading Screen
    const ldStyleSel = el("select", { onChange: (e) => { ld.style = e.target.value; commitDraft(true); } }, [
      el("option", { value: "kanagawa-wave", text: "Kanagawa Wave (Biểu tượng sóng)" }),
      el("option", { value: "minimal", text: "Tối giản (Minimal Ring)" }),
      el("option", { value: "terminal", text: "Terminal (Dấu nhắc >_)" }),
    ]);
    ldStyleSel.value = ld.style || "kanagawa-wave";

    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title", text: "Màn hình khởi động (Loading Screen)" }),
      el("div", { class: "grid2" }, [
        el("input", {
          type: "text", value: ld.title || "", placeholder: "Tiêu đề...",
          onInput: (e) => { ld.title = e.target.value; commitDraft(false); },
          onChange: (e) => { ld.title = e.target.value; commitDraft(true); },
        }),
        ldStyleSel,
      ]),
      el("input", {
        type: "text", value: ld.subtitle || "", placeholder: "Dòng chữ phụ...",
        onInput: (e) => { ld.subtitle = e.target.value; commitDraft(false); },
        onChange: (e) => { ld.subtitle = e.target.value; commitDraft(true); },
      }),
      el("div", { class: "row" }, [
        el("label", { class: "toggle" }, [
          el("input", { type: "checkbox", ...(ld.showEmblem !== false ? { checked: "checked" } : {}), onChange: (e) => { ld.showEmblem = e.target.checked; commitDraft(true); } }),
          "Hiện biểu tượng",
        ]),
        el("label", { class: "toggle" }, [
          el("input", { type: "checkbox", ...(ld.showProgress !== false ? { checked: "checked" } : {}), onChange: (e) => { ld.showProgress = e.target.checked; commitDraft(true); } }),
          "Hiện thanh tiến trình",
        ]),
      ]),
    ]));

    // Custom CSS editor
    const cssStatusHint = el("span", { class: "hint" });
    const updateCssHint = () => {
      const b = countCssBraces(state.customCss || "");
      if (b.open !== b.close) {
        cssStatusHint.textContent = `⚠️ Lệch ngoặc { ${b.open} / } ${b.close}`;
        cssStatusHint.style.color = "#E46876";
      } else if (state.customCssDirty) {
        cssStatusHint.textContent = "Chưa áp dụng • Ctrl+S để lưu";
        cssStatusHint.style.color = "#E6C384";
      } else {
        cssStatusHint.textContent = "Đã đồng bộ • Tab thụt lề";
        cssStatusHint.style.color = "#98BB6C";
      }
    };
    updateCssHint();

    const cssArea = el("textarea", {
      class: "code",
      placeholder: "/* Nhập CSS tùy biến riêng tại đây... */",
      onInput: (e) => {
        state.customCss = e.target.value;
        state.customCssDirty = state.customCss !== state.savedCustomCss;
        updateCssHint();
        updateBadgesAndButtons();
      },
    });
    cssArea.value = state.customCss || "";
    cssArea.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = cssArea.selectionStart;
        const end = cssArea.selectionEnd;
        cssArea.setRangeText("  ", start, end, "end");
        state.customCss = cssArea.value;
        state.customCssDirty = state.customCss !== state.savedCustomCss;
        updateCssHint();
        updateBadgesAndButtons();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S" || e.code === "KeyS")) {
        e.preventDefault();
        void saveCustomCssNow(false).then(() => updateCssHint());
      }
    });

    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title" }, ["Custom CSS (custom.css)", cssStatusHint]),
      cssArea,
      el("button", {
        type: "button", class: "btn accent", text: "✨ Áp dụng Custom CSS ngay",
        onClick: async () => {
          await saveCustomCssNow(false);
          updateCssHint();
        },
      }),
    ]));

    // Studio Options & Tools
    const pillPosSel = el("select", {
      onChange: (e) => {
        d.studio = d.studio || {};
        d.studio.pillPosition = e.target.value;
        updatePillVisibility();
        commitDraft(true);
      },
    }, [
      el("option", { value: "bottom-right", text: "Góc dưới phải" }),
      el("option", { value: "bottom-left", text: "Góc dưới trái" }),
      el("option", { value: "top-right", text: "Góc trên phải" }),
    ]);
    pillPosSel.value = st.pillPosition || "bottom-right";

    const resetConfirming = state.confirmResetUntil > Date.now();
    const resetBtn = el("button", {
      type: "button",
      class: "btn sm" + (resetConfirming ? " danger" : ""),
      text: resetConfirming ? "⚠️ Bấm lại để Reset?" : "↺ Reset mặc định",
      title: "Khôi phục cấu hình mặc định và xóa custom.css",
      onClick: async () => {
        if (Date.now() > state.confirmResetUntil) {
          state.confirmResetUntil = Date.now() + 4000;
          renderBody();
          setStatus("Bấm lại lần nữa để xác nhận Reset mặc định (sẽ xóa custom.css)", "busy");
          return;
        }
        state.confirmResetUntil = 0;
        try {
          setStatus("Đang khôi phục mặc định...", "busy");
          const data = await sendCommand("reset-default");
          draftRevision++;
          state.customCssDirty = false;
          applyReceivedState(data, { force: true });
          setStatus("Đã khôi phục mặc định!", "ok");
        } catch (e) {
          setStatus("Lỗi reset: " + e.message, "err");
        }
      },
    });

    body.appendChild(el("div", { class: "sec" }, [
      el("div", { class: "sec-title", text: "Cài đặt Studio & Tiện ích" }),
      el("div", { class: "row" }, [
        el("label", { class: "toggle" }, [
          el("input", {
            type: "checkbox",
            ...(state.autoSave ? { checked: "checked" } : {}),
            onChange: (e) => {
              state.autoSave = e.target.checked;
              saveAutoSavePref(state.autoSave);
              if (state.autoSave && state.dirty) void flushConfigSave();
            },
          }),
          "Tự động lưu khi kéo",
        ]),
        el("label", { class: "toggle" }, [
          el("input", {
            type: "checkbox",
            ...(st.showTriggerPill !== false ? { checked: "checked" } : {}),
            onChange: (e) => {
              d.studio = d.studio || {};
              d.studio.showTriggerPill = e.target.checked;
              updatePillVisibility();
              commitDraft(true);
            },
          }),
          "Hiện nút nổi (Ctrl+Alt+K)",
        ]),
      ]),
      el("div", { class: "row" }, [el("span", { style: { fontSize: "11px", color: "#CFC8A3" }, text: "Vị trí nút nổi" }), el("div", { style: { width: "160px" } }, [pillPosSel])]),
      el("div", { class: "grid3" }, [
        el("button", {
          type: "button", class: "btn sm", text: "📂 Mở thư mục",
          onClick: async () => {
            try {
              await sendCommand("open-folder");
            } catch (e) {
              setStatus("Lỗi mở thư mục: " + e.message, "err");
            }
          },
        }),
        el("button", {
          type: "button", class: "btn sm", text: "🔄 Reload app",
          onClick: async () => {
            try {
              await sendCommand("reload-window");
            } catch (e) {
              setStatus("Lỗi reload: " + e.message, "err");
            }
          },
        }),
        resetBtn,
      ]),
    ]));
  }

  function renderBody() {
    const sameTab = lastRenderedTab === state.activeTab;
    const prevScroll = sameTab ? body.scrollTop : 0;
    const prevLibGrid = sameTab ? body.querySelector(".lib-grid") : null;
    const prevLibScroll = prevLibGrid ? prevLibGrid.scrollTop : 0;
    lastRenderedTab = state.activeTab;

    while (body.firstChild) body.removeChild(body.firstChild);
    const d = state.draft;
    if (!d) {
      body.appendChild(el("div", { style: { textAlign: "center", padding: "30px", color: "#CFC8A3" }, text: "Đang tải dữ liệu Theme Studio..." }));
      return;
    }
    if (state.activeTab === "profiles") renderProfilesTab(d);
    else if (state.activeTab === "wallpaper") renderWallpaperTab(d);
    else if (state.activeTab === "surfaces") renderSurfacesTab(d);
    else if (state.activeTab === "colors") renderColorsTab(d);
    else renderAdvancedTab(d);

    if (sameTab) {
      body.scrollTop = prevScroll;
      if (prevLibScroll > 0) {
        const nextLibGrid = body.querySelector(".lib-grid");
        if (nextLibGrid) nextLibGrid.scrollTop = prevLibScroll;
      }
    } else {
      body.scrollTop = 0;
    }

    if (savedPos && panel.classList.contains("open")) {
      applyPos(savedPos.left, savedPos.top);
    }
  }

  function renderAll() {
    updateBadgesAndButtons();
    updatePillVisibility();
    if (panel.classList.contains("open")) renderBody();
  }

  // Watch body class changes (dark <-> light toggle)
  let bodyObserver = null;
  if (document.body) {
    bodyObserver = new MutationObserver(() => {
      modeBadge.textContent = document.body.classList.contains("theme-light") ? "☀️ Light" : "🌙 Dark";
    });
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  // Initial sync of pill visibility
  sendCommand("get-state").then((data) => applyReceivedState(data, { force: true })).catch(() => {});

  window.__knStudio = {
    open: openPanel,
    close: closePanel,
    toggle: () => (panel.classList.contains("open") ? closePanel() : openPanel()),
    stop: () => {
      clearTimeout(saveDebounce);
      for (const entry of pending.values()) {
        if (entry.timer) clearTimeout(entry.timer);
        try { entry.reject(new Error("Studio stopped")); } catch {}
      }
      pending.clear();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("resize", onWindowResize);
      if (bodyObserver) {
        bodyObserver.disconnect();
        bodyObserver = null;
      }
      clearLiveDomOverrides();
      try { host.remove(); } catch {}
      delete window.__knStudio;
      delete window.__knStudioReceive;
    },
  };
  return "installed";
})();

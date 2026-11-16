/**
 * Shared compiler & manager for Antigravity Theme (Kanagawa Studio).
 * Used by both CLI (`scripts/apply_kanagawa_config.js`) and the Electron runtime (`patch/pixelTheme.js`).
 * Pure Node.js standard library only (zero external dependencies).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MIME_MAP = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const EXT_BY_MIME = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/bmp": ".bmp",
  "image/svg+xml": ".svg",
  "image/x-icon": ".ico",
};

const PRESETS = {
  "kanagawa-wave": {
    label: "Kanagawa Wave",
    agentAvatar: {
      bgStops: ["#FAF7E6", "#F6ECC9", "#EBE3CC"],
      iconStops: ["#1F6E97", "#285C84", "#0E3252"],
    },
    composer: {
      rimStart: "#7AA89F",
      rimMid: "#EAE6D3",
      rimEnd: "#E6C384",
      innerStart: "#1C3446",
      innerMid: "#121822",
      innerEnd: "#382E1E",
      userBubbleStart: "#1C344A",
      userBubbleEnd: "#16283A",
      userBubbleBorder: "#7AA89F",
    },
    dark: {
      chromeBg: "#131720",
      chromeFg: "#EAE6D3",
      primary: "#E6C384",
      accentBlue: "#7E9CD8",
      accentAqua: "#7AA89F",
      accentGreen: "#98BB6C",
      accentPink: "#D27E99",
      accentViolet: "#957FB8",
      accentOrange: "#FFA066",
      text: "#EAE6D3",
      textMuted: "#CFC8A3",
      textSubtle: "#8A8980",
      surfaceBase: "#11161F",
      sidebarBase: "#0E121A",
      overlayBase: "#0F141D",
      scrimBase: "#0B0F17",
      selection: "#2D4F67",
    },
    light: {
      chromeBg: "#E5DDB0",
      chromeFg: "#3E3E4C",
      primary: "#43436C",
      text: "#3E3E4C",
      textMuted: "#625F53",
      paper0: "#D5CEA3",
      paper1: "#DCD5AC",
      paper2: "#E5DDB0",
      paper3: "#F2ECBC",
      surfaceBase: "#F7F3D6",
      sidebarBase: "#EBE5C2",
      overlayBase: "#F2ECBC",
      scrimBase: "#F2ECBC",
    },
  },
  "kanagawa-dragon": {
    label: "Kanagawa Dragon",
    agentAvatar: {
      bgStops: ["#F3ECD8", "#E6D9B8", "#D8C89E"],
      iconStops: ["#8EA4A2", "#625E5A", "#1D1C19"],
    },
    composer: {
      rimStart: "#8EA4A2",
      rimMid: "#C5C9C5",
      rimEnd: "#C4B28A",
      innerStart: "#24221E",
      innerMid: "#181614",
      innerEnd: "#2B241D",
      userBubbleStart: "#26282A",
      userBubbleEnd: "#1C1A17",
      userBubbleBorder: "#8EA4A2",
    },
    dark: {
      chromeBg: "#151412",
      chromeFg: "#C5C9C5",
      primary: "#C4B28A",
      accentBlue: "#8BA4B0",
      accentAqua: "#8EA4A2",
      accentGreen: "#87A987",
      accentPink: "#C4746E",
      accentViolet: "#8992A7",
      accentOrange: "#B6927B",
      text: "#C5C9C5",
      textMuted: "#A6A69C",
      textSubtle: "#737C73",
      surfaceBase: "#181614",
      sidebarBase: "#131210",
      overlayBase: "#1A1815",
      scrimBase: "#100F0E",
      selection: "#2D4F67",
    },
    light: {
      chromeBg: "#E6DEC8",
      chromeFg: "#3A3832",
      primary: "#4D699B",
      text: "#3A3832",
      textMuted: "#686459",
      paper0: "#D2C9AE",
      paper1: "#DCD4BC",
      paper2: "#E6DEC8",
      paper3: "#F3ECD8",
      surfaceBase: "#F5EFE0",
      sidebarBase: "#EAE2CE",
      overlayBase: "#F3ECD8",
      scrimBase: "#F3ECD8",
    },
  },
  "sakura-dusk": {
    label: "Sakura Dusk",
    agentAvatar: {
      bgStops: ["#FCECF2", "#F7D9E4", "#ECC3D3"],
      iconStops: ["#957FB8", "#7E5A88", "#4A2E56"],
    },
    composer: {
      rimStart: "#9CD5C9",
      rimMid: "#F1E8EE",
      rimEnd: "#E6A9BD",
      innerStart: "#2A1F38",
      innerMid: "#1B1626",
      innerEnd: "#38212F",
      userBubbleStart: "#322347",
      userBubbleEnd: "#241934",
      userBubbleBorder: "#E6A9BD",
    },
    dark: {
      chromeBg: "#171421",
      chromeFg: "#F1E8EE",
      primary: "#E6A9BD",
      accentBlue: "#A3B8EF",
      accentAqua: "#9CD5C9",
      accentGreen: "#A7C986",
      accentPink: "#D27E99",
      accentViolet: "#B69EE0",
      accentOrange: "#F3AE82",
      text: "#F1E8EE",
      textMuted: "#D4C3CF",
      textSubtle: "#8E7E8B",
      surfaceBase: "#1B1626",
      sidebarBase: "#14101D",
      overlayBase: "#1D1729",
      scrimBase: "#120E1A",
      selection: "#47325C",
    },
    light: {
      chromeBg: "#F3E4EA",
      chromeFg: "#3E3442",
      primary: "#7D486D",
      text: "#3E3442",
      textMuted: "#6F5F6D",
      paper0: "#E4CED7",
      paper1: "#ECD9E1",
      paper2: "#F3E4EA",
      paper3: "#FAF0F4",
      surfaceBase: "#FCF5F8",
      sidebarBase: "#F4E7EC",
      overlayBase: "#FAF0F4",
      scrimBase: "#FAF0F4",
    },
  },
  "midnight-aqua": {
    label: "Midnight Aqua",
    agentAvatar: {
      bgStops: ["#E6F7F5", "#CBECE8", "#B4DFDA"],
      iconStops: ["#1E7898", "#185978", "#0B354D"],
    },
    composer: {
      rimStart: "#7DCFFF",
      rimMid: "#E1EEF4",
      rimEnd: "#73DACA",
      innerStart: "#13293E",
      innerMid: "#0F1926",
      innerEnd: "#133238",
      userBubbleStart: "#15324D",
      userBubbleEnd: "#0F2438",
      userBubbleBorder: "#73DACA",
    },
    dark: {
      chromeBg: "#0D1520",
      chromeFg: "#E1EEF4",
      primary: "#73DACA",
      accentBlue: "#7AA2F7",
      accentAqua: "#7DCFFF",
      accentGreen: "#9ECE6A",
      accentPink: "#F7768E",
      accentViolet: "#BB9AF7",
      accentOrange: "#FF9E64",
      text: "#E1EEF4",
      textMuted: "#B7CBD9",
      textSubtle: "#6E8599",
      surfaceBase: "#0F1926",
      sidebarBase: "#0B121C",
      overlayBase: "#101B29",
      scrimBase: "#091019",
      selection: "#1E425E",
    },
    light: {
      chromeBg: "#DCECEF",
      chromeFg: "#243746",
      primary: "#1C6B78",
      text: "#243746",
      textMuted: "#516978",
      paper0: "#C5DDE2",
      paper1: "#D1E5E9",
      paper2: "#DCECEF",
      paper3: "#EDF6F8",
      surfaceBase: "#F3FAFB",
      sidebarBase: "#E3F0F3",
      overlayBase: "#EDF6F8",
      scrimBase: "#EDF6F8",
    },
  },
  "tokyo-night": {
    label: "Tokyo Night",
    agentAvatar: {
      bgStops: ["#EEF2FF", "#DCE4FF", "#C6D2FF"],
      iconStops: ["#3D59A1", "#7AA2F7", "#1A1B26"],
    },
    composer: {
      rimStart: "#7AA2F7",
      rimMid: "#C0CAF5",
      rimEnd: "#BB9AF7",
      innerStart: "#1B2136",
      innerMid: "#161824",
      innerEnd: "#241E38",
      userBubbleStart: "#232B45",
      userBubbleEnd: "#191E30",
      userBubbleBorder: "#7AA2F7",
    },
    dark: {
      chromeBg: "#16161E",
      chromeFg: "#C0CAF5",
      primary: "#7AA2F7",
      accentBlue: "#7AA2F7",
      accentAqua: "#7DCFFF",
      accentGreen: "#9ECE6A",
      accentPink: "#F7768E",
      accentViolet: "#BB9AF7",
      accentOrange: "#FF9E64",
      text: "#C0CAF5",
      textMuted: "#A9B1D6",
      textSubtle: "#565F89",
      surfaceBase: "#1A1B26",
      sidebarBase: "#13141C",
      overlayBase: "#1D1F2C",
      scrimBase: "#101118",
      selection: "#283457",
    },
    light: {
      chromeBg: "#D5D6DB",
      chromeFg: "#343B58",
      primary: "#34548A",
      text: "#343B58",
      textMuted: "#565A6E",
      paper0: "#C4C6CE",
      paper1: "#CFD1D8",
      paper2: "#D5D6DB",
      paper3: "#E6E7ED",
      surfaceBase: "#EDEFF5",
      sidebarBase: "#DFE1E8",
      overlayBase: "#E6E7ED",
      scrimBase: "#E6E7ED",
    },
  },
  "nordic-frost": {
    label: "Nordic Frost",
    agentAvatar: {
      bgStops: ["#ECEFF4", "#E5E9F0", "#D8DEE9"],
      iconStops: ["#5E81AC", "#81A1C1", "#2E3440"],
    },
    composer: {
      rimStart: "#88C0D0",
      rimMid: "#ECEFF4",
      rimEnd: "#81A1C1",
      innerStart: "#27303F",
      innerMid: "#202633",
      innerEnd: "#2B3646",
      userBubbleStart: "#2E3B4E",
      userBubbleEnd: "#242D3B",
      userBubbleBorder: "#88C0D0",
    },
    dark: {
      chromeBg: "#242933",
      chromeFg: "#ECEFF4",
      primary: "#88C0D0",
      accentBlue: "#81A1C1",
      accentAqua: "#8FBCBB",
      accentGreen: "#A3BE8C",
      accentPink: "#BF616A",
      accentViolet: "#B48EAD",
      accentOrange: "#D08770",
      text: "#ECEFF4",
      textMuted: "#D8DEE9",
      textSubtle: "#7B88A1",
      surfaceBase: "#282E3A",
      sidebarBase: "#20252F",
      overlayBase: "#2B313E",
      scrimBase: "#1C2029",
      selection: "#3B4252",
    },
    light: {
      chromeBg: "#E5E9F0",
      chromeFg: "#2E3440",
      primary: "#5E81AC",
      text: "#2E3440",
      textMuted: "#4C566A",
      paper0: "#CBD2DF",
      paper1: "#D8DEE9",
      paper2: "#E5E9F0",
      paper3: "#ECEFF4",
      surfaceBase: "#F4F6F9",
      sidebarBase: "#EAEFF5",
      overlayBase: "#ECEFF4",
      scrimBase: "#ECEFF4",
    },
  },
};

function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function defaultConfig() {
  const wave = PRESETS["kanagawa-wave"];
  return {
    schemaVersion: 2,
    activeProfile: "kanagawa-wave",
    preset: "kanagawa-wave",
    wallpaper: "KEEP_EMBEDDED",
    wallpaperLight: "SAME",
    wallpaperPosition: "right top",
    wallpaperPositionLight: "SAME",
    wallpaperFit: "cover",
    wallpaperEffects: {
      blur: 0,
      brightness: 100,
      contrast: 100,
      saturate: 100,
      opacity: 100,
      scale: 100,
      scrimOpacity: 75,
      scrimStyle: "directional",
    },
    surfaces: {
      sidebarOpacity: 64,
      panelOpacity: 42,
      chatOpacity: 66,
      userBubbleOpacity: 58,
      composerOpacity: 44,
      codeOpacity: 72,
      editorOpacity: 64,
      overlayOpacity: 96,
      titlebarOpacity: 74,
      glassBlur: 0,
      glassSaturate: 130,
      panelRadius: 14,
      cardRadius: 12,
      composerRadius: 16,
      bubbleRadius: 16,
    },
    avatars: {
      userVisible: true,
      userSize: 36,
      userRadius: 18,
      userRotate: 18,
      agentVisible: true,
      agentSize: 36,
      agentRadius: 18,
      agentRotate: -18,
    },
    composer: cloneDeep(wave.composer),
    typography: {
      uiFont: "",
      monoFont: "",
      chatFontSize: 0,
      codeFontSize: 0,
      lineHeight: 1.62,
    },
    userAvatar: "KEEP_EMBEDDED",
    agentAvatar: {
      image: "KEEP_EMBEDDED",
      bgStops: [...wave.agentAvatar.bgStops],
      iconStops: [...wave.agentAvatar.iconStops],
    },
    dark: cloneDeep(wave.dark),
    light: cloneDeep(wave.light),
    loading: {
      title: "Antigravity",
      subtitle: "Ready for Kanagawa Wave...",
      style: "kanagawa-wave",
      showEmblem: true,
      showProgress: true,
    },
    studio: {
      showTriggerPill: true,
      pillPosition: "bottom-right",
      language: "vi",
    },
  };
}

function pickFinite(val, fallback) {
  if (val === null || val === undefined || val === "" || typeof val === "boolean") return fallback;
  if (typeof val === "string" && !val.trim()) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function mergeConfig(raw) {
  const def = defaultConfig();
  const src = raw && typeof raw === "object" ? raw : {};
  const merged = {
    ...def,
    ...src,
    schemaVersion: 2,
    wallpaperEffects: { ...def.wallpaperEffects, ...(src.wallpaperEffects || {}) },
    surfaces: { ...def.surfaces, ...(src.surfaces || {}) },
    avatars: { ...def.avatars, ...(src.avatars || {}) },
    composer: { ...def.composer, ...(src.composer || {}) },
    typography: { ...def.typography, ...(src.typography || {}) },
    agentAvatar: {
      ...def.agentAvatar,
      ...(src.agentAvatar || {}),
      bgStops: (src.agentAvatar && Array.isArray(src.agentAvatar.bgStops) && src.agentAvatar.bgStops.length >= 3)
        ? src.agentAvatar.bgStops.slice(0, 3)
        : [...def.agentAvatar.bgStops],
      iconStops: (src.agentAvatar && Array.isArray(src.agentAvatar.iconStops) && src.agentAvatar.iconStops.length >= 3)
        ? src.agentAvatar.iconStops.slice(0, 3)
        : [...def.agentAvatar.iconStops],
    },
    dark: { ...def.dark, ...(src.dark || {}) },
    light: { ...def.light, ...(src.light || {}) },
    loading: { ...def.loading, ...(src.loading || {}) },
    studio: { ...def.studio, ...(src.studio || {}) },
  };
  for (const key of ["blur", "brightness", "contrast", "saturate", "opacity", "scale", "scrimOpacity"]) {
    merged.wallpaperEffects[key] = pickFinite(merged.wallpaperEffects[key], def.wallpaperEffects[key]);
  }
  for (const key of Object.keys(def.surfaces)) {
    merged.surfaces[key] = pickFinite(merged.surfaces[key], def.surfaces[key]);
  }
  for (const key of ["userSize", "userRadius", "userRotate", "agentSize", "agentRadius", "agentRotate"]) {
    merged.avatars[key] = pickFinite(merged.avatars[key], def.avatars[key]);
  }
  merged.avatars.userVisible = merged.avatars.userVisible !== false && merged.avatars.userVisible !== "false";
  merged.avatars.agentVisible = merged.avatars.agentVisible !== false && merged.avatars.agentVisible !== "false";
  for (const key of ["chatFontSize", "codeFontSize", "lineHeight"]) {
    merged.typography[key] = pickFinite(merged.typography[key], def.typography[key]);
  }
  merged.studio.language = String(merged.studio.language || "").trim().toLowerCase() === "en" ? "en" : "vi";
  return merged;
}

function clamp(val, min, max, fallback) {
  const n = pickFinite(val, fallback);
  return Math.max(min, Math.min(max, n));
}

function sanitizeHex(hex, fallback) {
  const raw = String(hex ?? "").trim();
  const m6 = /^#?([0-9a-f]{6})$/i.exec(raw);
  if (m6) return `#${m6[1].toUpperCase()}`;
  const m3 = /^#?([0-9a-f]{3})$/i.exec(raw);
  if (m3) {
    const [r, g, b] = m3[1].toUpperCase().split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

function hexToRgb(hex) {
  const norm = sanitizeHex(hex, null);
  if (!norm) return null;
  const n = parseInt(norm.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function sanitizeCssFont(val) {
  return String(val || "")
    .replace(/\/\*|\*\//g, "")
    .replace(/[;{}<>\r\n\\]/g, "")
    .trim();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeAssetPrefix(name, fallback = "img", maxLen = 24) {
  const cleaned = String(name || fallback)
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, maxLen)
    .replace(/^[-_]+|[-_]+$/g, "");
  return cleaned || fallback;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getLibraryDir(themeDir) {
  return path.join(themeDir, "assets", "library");
}

function getProfilesDir(themeDir) {
  return path.join(themeDir, "profiles");
}

function saveBufferToLibrary(themeDir, buf, ext, prefix = "img") {
  const libDir = getLibraryDir(themeDir);
  ensureDir(libDir);
  const cleanExt = MIME_MAP[ext.toLowerCase()] ? ext.toLowerCase() : ".png";
  const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 12);
  const safePrefix = sanitizeAssetPrefix(prefix, "img", 24);

  // Reuse existing file with same hash if present
  const existing = fs.readdirSync(libDir).find((f) => f.includes(`-${hash}`) && MIME_MAP[path.extname(f).toLowerCase()]);
  if (existing) {
    return `library:${existing}`;
  }
  const filename = `${safePrefix}-${hash}${cleanExt}`;
  fs.writeFileSync(path.join(libDir, filename), buf);
  return `library:${filename}`;
}

function importAssetToLibrary(themeDir, sourcePath, prefix = "wp") {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Image file not found: ${sourcePath}`);
  }
  const ext = path.extname(sourcePath).toLowerCase();
  if (!MIME_MAP[ext]) {
    throw new Error(`Unsupported image extension "${ext}" for ${sourcePath}`);
  }
  const buf = fs.readFileSync(sourcePath);
  const baseName = sanitizeAssetPrefix(path.basename(sourcePath, ext), prefix, 18);
  return saveBufferToLibrary(themeDir, buf, ext, baseName);
}

function saveDataUrlToLibrary(themeDir, dataUrl, originalName = "drop") {
  const rawUrl = String(dataUrl || "").trim();
  const base = path.basename(originalName, path.extname(originalName)) || "img";
  const m = /^data:(image\/[a-z0-9+.-]+)(?:;[^;,=]+=[^;,]+)*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(rawUrl);
  if (!m) {
    // Handle plain or charset-qualified SVG data URLs (e.g. data:image/svg+xml;charset=utf-8,...)
    const svgM = /^data:image\/svg\+xml(?:;[^,]*)?,([\s\S]*)$/i.exec(rawUrl);
    if (svgM) {
      let svgText = svgM[1];
      try {
        svgText = decodeURIComponent(svgText);
      } catch {
        // Keep raw UTF-8 SVG if it contains unencoded '%' (e.g. width="100%")
      }
      if (!/<svg[\s>]/i.test(svgText)) {
        throw new Error("Invalid SVG data URL");
      }
      const buf = Buffer.from(svgText, "utf8");
      return saveBufferToLibrary(themeDir, buf, ".svg", base === "img" ? "svg" : base);
    }
    throw new Error("Invalid image data URL");
  }
  const mime = m[1].toLowerCase();
  const ext = EXT_BY_MIME[mime] || ".png";
  const buf = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
  return saveBufferToLibrary(themeDir, buf, ext, base);
}

function extractEmbeddedFromCss(css) {
  const assetsMatch = css.match(/\/\* === KANAGAWA-EMBEDDED-ASSETS-START === \*\/([\s\S]*?)\/\* === KANAGAWA-EMBEDDED-ASSETS-END === \*\//);
  const assetsBlock = assetsMatch ? assetsMatch[1] : css;
  const extractUrl = (src, patterns) => {
    for (const re of patterns) {
      const m = src.match(re);
      const raw = m && (m[1] || m[2] || m[3]);
      if (raw) {
        return `url("${raw.trim().replace(/^["']|["']$/g, "")}")`;
      }
    }
    return null;
  };
  const urlExpr = 'url\\(\\s*(?:"([^"]+)"|\'([^\']+)\'|([^)\\s"\']+))\\s*\\)';
  return {
    wpUrl: extractUrl(assetsBlock, [
      new RegExp(`(?:^|\\r?\\n)html::before\\s*\\{[^}]*?background-image:\\s*${urlExpr}`),
      new RegExp(`^[ \\t]*--kn-wallpaper\\s*:\\s*${urlExpr}\\s*;`, "m"),
    ]),
    wpLightUrl: extractUrl(assetsBlock, [
      new RegExp(`html:has\\(>\\s*body[^)]*\\)::before\\s*\\{[^}]*?background-image:\\s*${urlExpr}`),
    ]),
    uaUrl: extractUrl(assetsBlock, [
      new RegExp(`\\[data-testid="user-message-bubble"\\][^}{]*::before\\s*\\{[^}]*?background-image:\\s*${urlExpr}\\s*(?:!important)?\\s*;`),
      new RegExp(`\\.agy-user-bubble-frame:has\\(> \\[data-testid="user-message-bubble"\\]\\)::before\\s*\\{[^}]*?background-image:\\s*${urlExpr}\\s*(?:!important)?\\s*;`),
      new RegExp(`^[ \\t]*--kn-user-avatar\\s*:\\s*${urlExpr}\\s*;`, "m"),
    ]),
    aaUrl: extractUrl(assetsBlock, [
      new RegExp(`\\[data-testid="agent-response"\\][^}{]*::before\\s*\\{[^}]*?background-image:\\s*${urlExpr}\\s*(?:!important)?\\s*;`),
      new RegExp(`\\[data-testid="agent-response"\\][^{]*\\{[^}]*?background-image:\\s*${urlExpr}\\s*(?:!important)?\\s*;`),
      new RegExp(`^[ \\t]*--kn-gemini-avatar\\s*:\\s*${urlExpr}\\s*;`, "m"),
    ]),
  };
}

function dataUrlWrapperToLibrary(themeDir, urlWrapper, prefix) {
  if (!urlWrapper) return null;
  const inner = urlWrapper.replace(/^url\(\s*["']?/, "").replace(/["']?\s*\)$/, "");
  try {
    return saveDataUrlToLibrary(themeDir, inner, prefix);
  } catch {
    return null;
  }
}

function isBuiltInGeminiStarUrl(urlWrapper) {
  if (!urlWrapper || !/^url\(["']?data:image\/svg\+xml/i.test(urlWrapper)) return false;
  const decoded = (() => {
    try { return decodeURIComponent(urlWrapper); } catch { return urlWrapper; }
  })();
  return decoded.includes('id="kbg"') && decoded.includes('id="kgem"');
}

function seedLibraryFromCss(themeDir, css, onlySlots = null) {
  const libDir = getLibraryDir(themeDir);
  ensureDir(libDir);
  const embedded = extractEmbeddedFromCss(css);
  const seeded = {};
  const want = (slot) => !onlySlots || onlySlots.has(slot);
  if (want("wallpaper") && embedded.wpUrl) {
    seeded.wallpaper = dataUrlWrapperToLibrary(themeDir, embedded.wpUrl, "wallpaper");
  }
  if (want("wallpaperLight") && embedded.wpLightUrl) {
    seeded.wallpaperLight = dataUrlWrapperToLibrary(themeDir, embedded.wpLightUrl, "wallpaper-light");
  }
  if (want("userAvatar") && embedded.uaUrl) {
    seeded.userAvatar = dataUrlWrapperToLibrary(themeDir, embedded.uaUrl, "user-avatar");
  }
  if (want("agentAvatar") && embedded.aaUrl) {
    if (isBuiltInGeminiStarUrl(embedded.aaUrl)) {
      seeded.agentAvatar = "SVG_STAR";
    } else if (!embedded.aaUrl.startsWith('url("data:image/svg+xml,')) {
      seeded.agentAvatar = dataUrlWrapperToLibrary(themeDir, embedded.aaUrl, "agent-avatar");
    }
  }
  return seeded;
}

function listLibraryAssets(themeDir) {
  const libDir = getLibraryDir(themeDir);
  if (!fs.existsSync(libDir)) return [];
  const files = fs.readdirSync(libDir).filter((f) => MIME_MAP[path.extname(f).toLowerCase()]);
  return files
    .map((f) => {
      const full = path.join(libDir, f);
      const st = fs.statSync(full);
      return {
        id: `library:${f}`,
        filename: f,
        path: full,
        ext: path.extname(f).toLowerCase(),
        size: st.size,
        mtimeMs: st.mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function resolveAssetSpec(themeDir, spec) {
  if (!spec) return { kind: "empty" };
  const s = String(spec).trim();
  if (/^(NONE|off|false)$/i.test(s)) return { kind: "none" };
  if (/^SAME$/i.test(s)) return { kind: "same" };
  if (/^KEEP_EMBEDDED$/i.test(s)) return { kind: "keep" };
  if (/^SVG_STAR$/i.test(s)) return { kind: "svg_star" };
  if (/^data:|^url\(/i.test(s)) return { kind: "inline", value: s };
  if (s.startsWith("library:")) {
    const filename = s.slice("library:".length).replace(/[\\/]/g, "");
    const p = path.join(getLibraryDir(themeDir), filename);
    return { kind: "file", path: p, ref: `library:${filename}` };
  }
  const abs = path.isAbsolute(s) ? s : path.resolve(themeDir, s);
  return { kind: "file", path: abs, ref: null };
}

function fileToDataUrl(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Image file not found: ${filePath}`);
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_MAP[ext];
  if (!mime) {
    throw new Error(`Unsupported image extension "${ext}" for ${filePath}`);
  }
  const raw = fs.readFileSync(filePath);
  if (ext === ".svg") {
    return `url("data:image/svg+xml,${encodeURIComponent(raw.toString("utf8"))}")`;
  }
  return `url("data:${mime};base64,${raw.toString("base64")}")`;
}

function buildGeminiStarSvgUrl(bgStops, iconStops) {
  const defBg = ["#FAF7E6", "#F6ECC9", "#EBE3CC"];
  const defIcon = ["#1F6E97", "#285C84", "#0E3252"];
  const [b0, b1, b2] = [0, 1, 2].map((i) => sanitizeHex(bgStops && bgStops[i], defBg[i]));
  const [i0, i1, i2] = [0, 1, 2].map((i) => sanitizeHex(iconStops && iconStops[i], defIcon[i]));
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

function replaceCssVar(css, varName, value) {
  const esc = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^([ \\t]*${esc}\\s*:\\s*)(.+?)(;[ \\t]*)$`, "m");
  if (!re.test(css)) return css;
  return css.replace(re, (_, prefix, _old, suffix) => `${prefix}${value}${suffix}`);
}

function mixHex(hexA, hexB, ratio) {
  const a = sanitizeHex(hexA, null);
  const b = sanitizeHex(hexB, null);
  if (!a) return b || "#000000";
  if (!b) return a;
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const t = Math.max(0, Math.min(1, ratio));
  const mix = (c1, c2) => Math.round(c1 + (c2 - c1) * t).toString(16).padStart(2, "0");
  return `#${mix((na >> 16) & 255, (nb >> 16) & 255)}${mix((na >> 8) & 255, (nb >> 8) & 255)}${mix(na & 255, nb & 255)}`.toUpperCase();
}

function buildScrimGradient(rgbExpr, isLight, style) {
  const s = String(style || "directional").trim().toLowerCase();
  if (s === "none") return "none";
  if (s === "solid" || s === "uniform") {
    return `linear-gradient(180deg, rgba(${rgbExpr}, 1) 0%, rgba(${rgbExpr}, 1) 100%)`;
  }
  if (s === "gradient") {
    if (isLight) {
      return `linear-gradient(180deg, rgba(${rgbExpr}, 0.42) 0%, rgba(${rgbExpr}, 0.68) 55%, rgba(${rgbExpr}, 0.90) 100%)`;
    }
    return `linear-gradient(180deg, rgba(${rgbExpr}, 0.34) 0%, rgba(${rgbExpr}, 0.62) 55%, rgba(${rgbExpr}, 0.88) 100%)`;
  }
  if (s === "vignette") {
    const inner = isLight ? 0.25 : 0.18;
    const outer = isLight ? 0.84 : 0.82;
    return `radial-gradient(65% 65% at 50% 48%, rgba(${rgbExpr}, ${inner}) 0%, rgba(${rgbExpr}, ${outer}) 100%)`;
  }
  // directional (default): keeps top-right artwork clearer
  if (isLight) {
    return `radial-gradient(52% 48% at 86% 18%, rgba(${rgbExpr}, 0.36) 0%, rgba(${rgbExpr}, 0.78) 100%), linear-gradient(180deg, rgba(${rgbExpr}, 0.58) 0%, rgba(${rgbExpr}, 0.76) 100%)`;
  }
  return `radial-gradient(48% 46% at 86% 18%, rgba(${rgbExpr}, 0.18) 0%, rgba(${rgbExpr}, 0.72) 100%), linear-gradient(108deg, rgba(${rgbExpr}, 0.72) 0%, rgba(${rgbExpr}, 0.52) 56%, rgba(${rgbExpr}, 0.28) 100%)`;
}

function computeRootPaletteVars(cfg) {
  const d = cfg.dark || {};
  const l = cfg.light || {};
  const dScrim = sanitizeHex(d.scrimBase, "#0B0F17");
  const dSide = sanitizeHex(d.sidebarBase, "#0E121A");
  const dChrome = sanitizeHex(d.chromeBg, "#131720");
  const dSurf = sanitizeHex(d.surfaceBase, "#11161F");
  const dOver = sanitizeHex(d.overlayBase, "#0F141D");
  const dSubtle = sanitizeHex(d.textSubtle, "#8A8980");
  const dSel = sanitizeHex(d.selection, "#2D4F67");

  return {
    "--kw-sumiInk0": dScrim,
    "--kw-sumiInk1": dSide,
    "--kw-sumiInk2": dChrome,
    "--kw-sumiInk3": dSurf,
    "--kw-sumiInk4": mixHex(dOver, dSubtle, 0.35),
    "--kw-fujiWhite": sanitizeHex(d.text, "#EAE6D3"),
    "--kw-oldWhite": sanitizeHex(d.textMuted, "#CFC8A3"),
    "--kw-fujiGray": dSubtle,
    "--kw-waveBlue1": mixHex(dSurf, dSel, 0.55),
    "--kw-waveBlue2": dSel,
    "--kw-crystalBlue": sanitizeHex(d.accentBlue, "#7E9CD8"),
    "--kw-carpYellow": sanitizeHex(d.primary, "#E6C384"),
    "--kw-waveAqua": sanitizeHex(d.accentAqua, "#7AA89F"),
    "--kw-springGreen": sanitizeHex(d.accentGreen, "#98BB6C"),
    "--kw-sakuraPink": sanitizeHex(d.accentPink, "#D27E99"),
    "--kw-oniViolet": sanitizeHex(d.accentViolet, "#957FB8"),
    "--kw-surimiOrange": sanitizeHex(d.accentOrange, "#FFA066"),
    "--kl-white0": sanitizeHex(l.paper0, "#D5CEA3"),
    "--kl-white1": sanitizeHex(l.paper1, "#DCD5AC"),
    "--kl-white2": sanitizeHex(l.paper2, "#E5DDB0"),
    "--kl-white3": sanitizeHex(l.paper3, "#F2ECBC"),
    "--kl-ink1": sanitizeHex(l.text, "#3E3E4C"),
    "--kl-ink2": sanitizeHex(l.primary, "#43436C"),
    "--kl-gray2": sanitizeHex(l.textMuted, "#625F53"),
    "--px-chrome-dark-bg": dChrome,
    "--px-chrome-dark-fg": sanitizeHex(d.chromeFg, "#EAE6D3"),
    "--px-chrome-light-bg": sanitizeHex(l.chromeBg, "#E5DDB0"),
    "--px-chrome-light-fg": sanitizeHex(l.chromeFg, "#3E3E4C"),
  };
}

function buildSurfaceOverrideBlock(cfg) {
  const d = cfg.dark;
  const l = cfg.light;
  const fx = cfg.wallpaperEffects;
  const sf = cfg.surfaces;
  const av = cfg.avatars;
  const comp = cfg.composer;
  const typo = cfg.typography;

  const dSurf = hexToRgb(d.surfaceBase) || "17, 22, 31";
  const dSide = hexToRgb(d.sidebarBase) || "14, 18, 26";
  const dOver = hexToRgb(d.overlayBase) || "15, 20, 29";
  const dScrim = hexToRgb(d.scrimBase) || "11, 15, 23";
  const dChrome = hexToRgb(d.chromeBg) || "19, 23, 32";
  const dBlue = hexToRgb(d.accentBlue) || "126, 156, 216";
  const dAqua = hexToRgb(d.accentAqua) || "122, 168, 159";
  const dSel = hexToRgb(d.selection) || "45, 79, 103";
  const dPri = hexToRgb(d.primary) || "230, 195, 132";

  const lSurf = hexToRgb(l.surfaceBase) || "247, 243, 214";
  const lSide = hexToRgb(l.sidebarBase) || "235, 229, 194";
  const lOver = hexToRgb(l.overlayBase) || "242, 236, 188";
  const lScrim = hexToRgb(l.scrimBase) || "242, 236, 188";
  const lChrome = hexToRgb(l.chromeBg) || "229, 221, 176";
  const lPri = hexToRgb(l.primary) || "67, 67, 108";

  const cRim1 = hexToRgb(comp.rimStart) || dAqua;
  const cRim2 = hexToRgb(comp.rimMid) || "234, 230, 211";
  const cRim3 = hexToRgb(comp.rimEnd) || dPri;
  const cBg1 = hexToRgb(comp.innerStart) || "28, 52, 70";
  const cBg2 = hexToRgb(comp.innerMid) || "18, 24, 34";
  const cBg3 = hexToRgb(comp.innerEnd) || "56, 46, 30";
  const ub1 = hexToRgb(comp.userBubbleStart) || "28, 52, 74";
  const ub2 = hexToRgb(comp.userBubbleEnd) || "22, 40, 58";
  const ubB = hexToRgb(comp.userBubbleBorder) || dAqua;

  const wpBlur = clamp(fx.blur, 0, 40, 0);
  const wpBright = clamp(fx.brightness, 20, 200, 100);
  const wpContrast = clamp(fx.contrast, 30, 200, 100);
  const wpSat = clamp(fx.saturate, 0, 250, 100);
  const wpOpacity = (clamp(fx.opacity, 0, 100, 100) / 100).toFixed(2);
  const rawScale = clamp(fx.scale, 100, 200, 100) / 100;
  // Auto-expand slightly when blurring so edges never darken/shrink inward
  const wpScale = Math.max(rawScale, wpBlur > 0 ? 1 + wpBlur * 0.004 : 1).toFixed(3);
  const scrimAlpha = (clamp(fx.scrimOpacity, 0, 100, 75) / 100).toFixed(2);
  const scrimStyle = String(fx.scrimStyle || "directional").trim().toLowerCase();

  const sidebarA = (clamp(sf.sidebarOpacity, 0, 100, 64) / 100).toFixed(2);
  const sidebarTopA = Math.min(1, Number(sidebarA) + 0.08).toFixed(2);
  const sidebarMidA = Math.max(0, Number(sidebarA) - 0.10).toFixed(2);
  const panelA = (clamp(sf.panelOpacity, 0, 100, 42) / 100).toFixed(2);
  const panelMaxA = Math.min(1, Number(panelA) + 0.14).toFixed(2);
  const chatA = (clamp(sf.chatOpacity, 0, 100, 66) / 100).toFixed(2);
  const cardA = (clamp(sf.chatOpacity, 0, 100, 68) / 100).toFixed(2);
  const ubA = (clamp(sf.userBubbleOpacity, 0, 100, 58) / 100).toFixed(2);
  const compA = (clamp(sf.composerOpacity, 0, 100, 44) / 100).toFixed(2);
  const codeA = (clamp(sf.codeOpacity, 0, 100, 72) / 100).toFixed(2);
  const editorA = (clamp(sf.editorOpacity, 0, 100, 64) / 100).toFixed(2);
  const editorSideA = Math.max(0, Number(editorA) * 0.55).toFixed(2);
  const overlayA = (clamp(sf.overlayOpacity, 45, 100, 96) / 100).toFixed(2);
  const titlebarA = (clamp(sf.titlebarOpacity, 0, 100, 74) / 100).toFixed(2);

  const glassBlur = clamp(sf.glassBlur, 0, 32, 0);
  const glassSat = clamp(sf.glassSaturate, 80, 220, 130);
  const backdropVal = glassBlur > 0 ? `blur(${glassBlur}px) saturate(${glassSat}%)` : "none";

  const panelRadius = clamp(sf.panelRadius, 0, 32, 14);
  const cardRadius = clamp(sf.cardRadius, 0, 32, 12);
  const composerRadius = clamp(sf.composerRadius, 0, 32, 16);
  const bubbleRadius = clamp(sf.bubbleRadius, 0, 32, 16);

  const userAvHasAsset = !isNoneAssetRef(cfg.userAvatar);
  const userAvVis = av.userVisible !== false && userAvHasAsset;
  const userAvSize = clamp(av.userSize, 18, 64, 36);
  const userAvRadius = clamp(av.userRadius, 0, 50, 18);
  const userAvRotate = clamp(av.userRotate, -45, 45, 18);
  const userAvMt = userAvVis ? Math.round(userAvSize * 0.72) : 0;
  const userAvMr = userAvVis ? Math.max(14, Math.round(userAvSize * 0.39)) : 0;

  const agentAvHasAsset = !isNoneAssetRef(cfg.agentAvatar && cfg.agentAvatar.image);
  const agentAvVis = av.agentVisible !== false && agentAvHasAsset;
  const agentAvSize = clamp(av.agentSize, 18, 64, 36);
  const agentAvRadius = clamp(av.agentRadius, 0, 50, 18);
  const agentAvRotate = clamp(av.agentRotate, -45, 45, -18);
  const agentAvMt = agentAvVis ? Math.round(agentAvSize * 0.64) : 0;
  const agentAvMl = agentAvVis ? Math.max(6, Math.round(agentAvSize * 0.17)) : 0;

  const wpFit = /^(cover|contain|auto|100% 100%)$/.test(String(cfg.wallpaperFit || "")) ? cfg.wallpaperFit : "cover";
  const wpPos = String(cfg.wallpaperPosition || "right top").replace(/[;{}<>\r\n]/g, "").trim() || "right top";
  const wpPosLight = (!cfg.wallpaperPositionLight || cfg.wallpaperPositionLight === "SAME")
    ? wpPos
    : (String(cfg.wallpaperPositionLight).replace(/[;{}<>\r\n]/g, "").trim() || wpPos);

  const uiFont = sanitizeCssFont(typo.uiFont);
  const monoFont = sanitizeCssFont(typo.monoFont);
  const rawChatFontSize = clamp(typo.chatFontSize, 0, 26, 0);
  const rawCodeFontSize = clamp(typo.codeFontSize, 0, 24, 0);
  const uiFontVar = uiFont ? `${uiFont}, "Segoe UI", system-ui, sans-serif` : "none";
  const monoFontVar = monoFont ? `${monoFont}, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` : "none";
  const chatFontSizeVar = rawChatFontSize > 0 ? `${clamp(rawChatFontSize, 10, 26, 14)}px` : "none";
  const codeFontSizeVar = rawCodeFontSize > 0 ? `${clamp(rawCodeFontSize, 9, 24, 13)}px` : "none";
  const lineHeight = clamp(typo.lineHeight, 1.15, 2.2, 1.62).toFixed(2);

  const filterExpr = `blur(${wpBlur}px) brightness(${wpBright}%) contrast(${wpContrast}%) saturate(${wpSat}%)`;
  const darkScrimBg = buildScrimGradient("var(--kn-d-scrim-rgb)", false, scrimStyle);
  const lightScrimBg = buildScrimGradient("var(--kn-l-scrim-rgb)", true, scrimStyle);
  const paletteVars = computeRootPaletteVars(cfg);
  const paletteLines = Object.entries(paletteVars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");

  const staticTypographyRules = [];
  if (uiFontVar !== "none") {
    staticTypographyRules.push(`html:not([data-kn-ui-font="0"]),
html:not([data-kn-ui-font="0"]) body {
  --font-sans: var(--kn-ui-font) !important;
  font-family: var(--kn-ui-font) !important;
}
html:not([data-kn-ui-font="0"]) body :not(:where(
  pre, pre *, code, code *, kbd, samp,
  .font-mono, .font-mono *,
  .monaco-editor, .monaco-editor *,
  .xterm, .xterm *,
  [class*="material-symbols"], [class*="codicon"], [data-icon],
  [id="kn-studio-host"], [id="kn-studio-host"] *
)) {
  font-family: var(--kn-ui-font) !important;
}`);
  }
  if (monoFontVar !== "none") {
    staticTypographyRules.push(`html:not([data-kn-mono-font="0"]),
html:not([data-kn-mono-font="0"]) body {
  --font-mono: var(--kn-mono-font) !important;
}
html:not([data-kn-mono-font="0"]) body :is(
  pre, pre *, code, code *, kbd, samp,
  .font-mono, .font-mono *,
  .monaco-editor, .monaco-editor .view-lines, .monaco-editor .view-line,
  .xterm, .xterm-rows
) {
  --font-mono: var(--kn-mono-font) !important;
  font-family: var(--kn-mono-font) !important;
}`);
  }
  if (chatFontSizeVar !== "none") {
    staticTypographyRules.push(`html:not([data-kn-chat-size="0"]) body :is(
  [data-markdown-root],
  [data-markdown-root] :is(p, li, ul, ol, blockquote, td, th),
  [data-testid="user-message-bubble"],
  [data-testid="user-message-bubble"] *,
  .agy-user-bubble,
  .agy-user-bubble *,
  .leading-relaxed:not(:where([role="menu"] *, [role="listbox"] *, [role="dialog"] *, [role="tooltip"] *, [data-mention-menu] *, .surface-composer *, [id="kn-studio-host"] *))
) {
  font-size: var(--kn-chat-font-size) !important;
}`);
  }
  if (codeFontSizeVar !== "none") {
    staticTypographyRules.push(`html:not([data-kn-code-size="0"]) body :is(
  pre, pre *, code, kbd, samp,
  .monaco-editor .view-lines, .monaco-editor .view-line,
  .xterm-rows
) {
  font-size: var(--kn-code-font-size) !important;
}`);
  }
  const extraTypographyCss = staticTypographyRules.length > 0 ? `\n${staticTypographyRules.join("\n")}` : "";

  return `/* === KANAGAWA-CUSTOM-SURFACE-START === */
:root {
${paletteLines}
  --kn-wp-pos: ${wpPos};
  --kn-wp-pos-light: ${wpPosLight};
  --kn-wp-size: ${wpFit};
  --kn-wp-filter: ${filterExpr};
  --kn-wp-opacity: ${wpOpacity};
  --kn-wp-scale: ${wpScale};
  --kn-scrim-opacity: ${scrimAlpha};
  --kn-scrim-image-dark: ${darkScrimBg};
  --kn-scrim-image-light: ${lightScrimBg};
  --kn-sidebar-a: ${sidebarA};
  --kn-sidebar-top-a: ${sidebarTopA};
  --kn-sidebar-mid-a: ${sidebarMidA};
  --kn-panel-a: ${panelA};
  --kn-panel-max-a: ${panelMaxA};
  --kn-chat-a: ${chatA};
  --kn-card-a: ${cardA};
  --kn-ub-a: ${ubA};
  --kn-comp-a: ${compA};
  --kn-code-a: ${codeA};
  --kn-editor-a: ${editorA};
  --kn-editor-side-a: ${editorSideA};
  --kn-overlay-a: ${overlayA};
  --kn-titlebar-a: ${titlebarA};
  --kn-backdrop: ${backdropVal};
  --kn-panel-radius: ${panelRadius}px;
  --kn-card-radius: ${cardRadius}px;
  --kn-composer-radius: ${composerRadius}px;
  --kn-bubble-radius: ${bubbleRadius}px;
  --kn-ui-font: ${uiFontVar};
  --kn-mono-font: ${monoFontVar};
  --kn-chat-font-size: ${chatFontSizeVar};
  --kn-code-font-size: ${codeFontSizeVar};
  --kn-line-height: ${lineHeight};
  --kn-user-av-display: ${userAvVis ? "block" : "none"};
  --kn-user-av-size: ${userAvSize}px;
  --kn-user-av-top: ${Math.round(-userAvSize * 0.66)}px;
  --kn-user-av-radius: ${userAvRadius}%;
  --kn-user-av-rotate: ${userAvRotate}deg;
  --kn-user-av-mt: ${userAvMt}px;
  --kn-user-av-mr: ${userAvMr}px;
  --kn-agent-av-display: ${agentAvVis ? "block" : "none"};
  --kn-agent-av-size: ${agentAvSize}px;
  --kn-agent-av-top: ${Math.round(-agentAvSize * 0.55)}px;
  --kn-agent-av-radius: ${agentAvRadius}%;
  --kn-agent-av-rotate: ${agentAvRotate}deg;
  --kn-agent-av-mt: ${agentAvMt}px;
  --kn-agent-av-ml: ${agentAvMl}px;
  --kn-d-surf-rgb: ${dSurf};
  --kn-d-side-rgb: ${dSide};
  --kn-d-over-rgb: ${dOver};
  --kn-d-scrim-rgb: ${dScrim};
  --kn-d-chrome-rgb: ${dChrome};
  --kn-d-blue-rgb: ${dBlue};
  --kn-d-aqua-rgb: ${dAqua};
  --kn-d-sel-rgb: ${dSel};
  --kn-d-pri-rgb: ${dPri};
  --kn-l-surf-rgb: ${lSurf};
  --kn-l-side-rgb: ${lSide};
  --kn-l-over-rgb: ${lOver};
  --kn-l-scrim-rgb: ${lScrim};
  --kn-l-chrome-rgb: ${lChrome};
  --kn-l-pri-rgb: ${lPri};
  --kn-comp-rim-1-rgb: ${cRim1};
  --kn-comp-rim-2-rgb: ${cRim2};
  --kn-comp-rim-3-rgb: ${cRim3};
  --kn-comp-bg-1-rgb: ${cBg1};
  --kn-comp-bg-2-rgb: ${cBg2};
  --kn-comp-bg-3-rgb: ${cBg3};
  --kn-ub-bg-1-rgb: ${ub1};
  --kn-ub-bg-2-rgb: ${ub2};
  --kn-ub-border-rgb: ${ubB};
}${extraTypographyCss}
/* === KANAGAWA-CUSTOM-SURFACE-END === */`;
}

function buildLoadingHtml(cfg) {
  const d = cfg.dark || {};
  const l = cfg.light || {};
  const typo = cfg.typography || {};
  const loading = cfg.loading || {};
  const title = escapeHtml(String(loading.title || "").trim() || "Antigravity");
  const subtitle = escapeHtml(String(loading.subtitle || "").trim() || "Preparing Kanagawa workspace...");
  const rawStyle = String(loading.style || "kanagawa-wave").trim().toLowerCase();
  const style = (rawStyle === "minimal" || rawStyle === "terminal") ? rawStyle : "kanagawa-wave";
  const showEmblem = loading.showEmblem !== false;
  const showProgress = loading.showProgress !== false;

  const dChromeBg = sanitizeHex(d.chromeBg, "#131720");
  const dChromeFg = sanitizeHex(d.chromeFg, "#EAE6D3");
  const dMuted = sanitizeHex(d.textMuted, "#CFC8A3");
  const dAccent = sanitizeHex(d.primary, "#E6C384");
  const dSelection = sanitizeHex(d.selection, "#2D4F67");
  const dBlue = sanitizeHex(d.accentBlue, "#7E9CD8");
  const dAqua = sanitizeHex(d.accentAqua, "#7AA89F");
  const dGreen = sanitizeHex(d.accentGreen, "#98BB6C");

  const lChromeBg = sanitizeHex(l.chromeBg, "#E5DDB0");
  const lChromeFg = sanitizeHex(l.chromeFg, "#3E3E4C");
  const lMuted = sanitizeHex(l.textMuted, "#625F53");
  const lPrimary = sanitizeHex(l.primary, "#43436C");
  const lPaper3 = sanitizeHex(l.paper3, "#F2ECBC");

  const dWaveRgb = hexToRgb(dSelection) || "45, 79, 103";
  const dBlueRgb = hexToRgb(dBlue) || "126, 156, 216";
  const dAquaRgb = hexToRgb(dAqua) || "122, 168, 159";
  const lPaperRgb = hexToRgb(lPaper3) || "242, 236, 188";
  const lFgRgb = hexToRgb(lChromeFg) || "62, 62, 76";

  const uiFont = sanitizeCssFont(typo.uiFont);
  const monoFont = sanitizeCssFont(typo.monoFont);
  const uiFontStack = uiFont ? `${uiFont}, "Segoe UI", system-ui, -apple-system, sans-serif` : `"Segoe UI", system-ui, -apple-system, sans-serif`;
  const monoFontStack = monoFont ? `${monoFont}, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` : `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

  let emblemMarkup = "";
  if (showEmblem) {
    if (style === "minimal") {
      emblemMarkup = `<svg class="emblem emblem-minimal" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="48" cy="48" r="22" stroke="var(--accent)" stroke-width="2" stroke-opacity="0.7"/><circle cx="48" cy="48" r="7" fill="var(--accent)"/></svg>`;
    } else if (style === "terminal") {
      emblemMarkup = `<svg class="emblem emblem-terminal" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="20" width="68" height="56" rx="10" stroke="var(--aqua)" stroke-width="2" stroke-opacity="0.72" fill="var(--track)"/><path d="M28 40L39 48L28 56" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><line x1="45" y1="56" x2="64" y2="56" stroke="var(--green)" stroke-width="3" stroke-linecap="round"/></svg>`;
    } else {
      emblemMarkup = `<svg class="emblem" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="48" cy="42" r="24" fill="var(--accent)" fill-opacity="0.16" stroke="var(--accent)" stroke-opacity="0.55" stroke-width="1.25"/>
    <path d="M48 22C34 22 36.5 52 25.5 63.5C21.5 67.5 25.8 68.8 28.6 66.8C39.2 59.5 38.5 46.5 48 46.5C57.5 46.5 56.8 59.5 67.4 66.8C70.2 68.8 74.5 67.5 70.5 63.5C59.5 52 62 22 48 22Z" fill="var(--fg)" fill-opacity="0.92"/>
    <path class="wave-back" d="M12 68C22 61 32 61 42 67C52 73 64 73 84 65" stroke="var(--wave2)" stroke-width="2" stroke-linecap="round" stroke-opacity="0.65"/>
    <path class="wave-front" d="M16 74C28 68 38 75 50 71C62 67 71 70 80 74" stroke="var(--wave1)" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`;
    }
  }
  const barMarkup = showProgress
    ? style === "terminal"
      ? `<div class="term-bar" aria-hidden="true"><div class="term-bar-fill"></div></div>`
      : `<div class="bar"><div class="bar-fill"></div></div>`
    : "";

  const bodyMarkup = style === "terminal"
    ? `<div class="term-card">
    ${emblemMarkup}
    <div class="term-head"><span class="term-prompt">$</span> <span class="title">${title}</span><span class="cursor" aria-hidden="true"></span></div>
    ${barMarkup}
    <div class="sub"><span class="term-tag">[INIT]</span> ${subtitle}</div>
  </div>`
    : `${emblemMarkup}
  <div class="title">${title}</div>
  ${barMarkup}
  <div class="sub">${subtitle}</div>`;

  return `<!DOCTYPE html>
<html data-mode="{{MODE}}" data-style="${style}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">
<style>
  /* Generated by theme-builder.js from kanagawa.config.json */
  :root, html[data-mode="dark"] {
    --bg: ${dChromeBg};
    --fg: ${dChromeFg};
    --muted: ${dMuted};
    --accent: ${dAccent};
    --aqua: ${dAqua};
    --green: ${dGreen};
    --wave1: ${dSelection};
    --wave2: ${dBlue};
    --glow: rgba(${dWaveRgb}, 0.32);
    --track: rgba(${dBlueRgb}, 0.16);
    --term-border: rgba(${dAquaRgb}, 0.28);
  }
  html[data-mode="light"] {
    --bg: ${lChromeBg};
    --fg: ${lChromeFg};
    --muted: ${lMuted};
    --accent: ${lPrimary};
    --aqua: ${lPrimary};
    --green: ${lPrimary};
    --wave1: ${lPrimary};
    --wave2: ${lMuted};
    --glow: rgba(${lPaperRgb}, 0.72);
    --track: rgba(${lFgRgb}, 0.14);
    --term-border: rgba(${lFgRgb}, 0.22);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 50% 42%, var(--glow) 0%, var(--bg) 68%);
    background-color: var(--bg);
    color: var(--fg);
    font-family: ${uiFontStack};
    -webkit-app-region: drag;
    -webkit-user-select: none;
  }
  html[data-style="minimal"] body {
    background: var(--bg);
  }
  html[data-style="terminal"] body {
    font-family: ${monoFontStack};
    background:
      linear-gradient(180deg, rgba(${dAquaRgb}, 0.04) 0%, transparent 50%),
      var(--bg);
  }
  .emblem {
    width: 84px;
    height: 84px;
    margin-bottom: 20px;
    animation: float 3.2s ease-in-out infinite;
  }
  .emblem-minimal {
    width: 68px;
    height: 68px;
    animation: none;
  }
  .emblem-terminal {
    width: 64px;
    height: 64px;
    margin-bottom: 14px;
    animation: none;
  }
  .wave-back { animation: drift 4.5s ease-in-out infinite; transform-origin: center; }
  .wave-front { animation: drift 3.4s ease-in-out infinite reverse; transform-origin: center; }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  @keyframes drift {
    0%, 100% { transform: translateX(-2px); }
    50% { transform: translateX(2px); }
  }
  @keyframes blink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0.12; }
  }
  .title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.28em;
    color: var(--muted);
    margin-bottom: 14px;
    text-transform: uppercase;
  }
  .bar {
    width: 176px;
    height: 3px;
    border-radius: 999px;
    background: var(--track);
    overflow: hidden;
    margin-bottom: 12px;
  }
  .bar-fill {
    width: 48%;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--wave1), var(--wave2), var(--accent));
    animation: slide 1.7s ease-in-out infinite;
  }
  @keyframes slide {
    0% { transform: translateX(-110%); }
    100% { transform: translateX(220%); }
  }
  .sub {
    font-size: 12px;
    color: var(--muted);
    opacity: 0.85;
  }
  .term-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 280px;
    max-width: 380px;
    padding: 20px 24px;
    border-radius: 10px;
    border: 1px solid var(--term-border);
    background: rgba(${dWaveRgb}, 0.14);
  }
  html[data-mode="light"] .term-card {
    background: rgba(${lPaperRgb}, 0.52);
  }
  .term-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .term-head .title {
    margin-bottom: 0;
    font-size: 13px;
    letter-spacing: 0.14em;
    color: var(--fg);
  }
  .term-prompt {
    color: var(--accent);
    font-weight: 700;
  }
  .cursor {
    display: inline-block;
    width: 7px;
    height: 14px;
    background: var(--aqua);
    animation: blink 1.05s steps(1, end) infinite;
  }
  .term-bar {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: var(--track);
    overflow: hidden;
    margin-bottom: 10px;
  }
  .term-bar-fill {
    width: 40%;
    height: 100%;
    background: repeating-linear-gradient(90deg, var(--aqua) 0 10px, transparent 10px 13px);
    animation: slide 1.4s linear infinite;
  }
  .term-tag {
    color: var(--green);
    font-weight: 600;
    margin-right: 4px;
  }
</style>
</head>
<body>
  ${bodyMarkup}
</body>
</html>
`;
}

function countBracesOutsideCommentsAndStrings(css) {
  let open = 0;
  let close = 0;
  let inComment = false;
  let quote = null;
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

function ensureCustomCssFile(themeDir) {
  const customPath = path.join(themeDir, "custom.css");
  if (!fs.existsSync(customPath)) {
    fs.writeFileSync(
      customPath,
      "/* Add your own custom CSS overrides below. Never overwritten by presets or Studio. */\n",
      "utf8"
    );
  }
  return customPath;
}

function readCustomCss(themeDir, createIfMissing = true) {
  const customPath = path.join(themeDir, "custom.css");
  if (!fs.existsSync(customPath)) {
    if (!createIfMissing) return "";
    ensureCustomCssFile(themeDir);
  }
  return fs.readFileSync(customPath, "utf8");
}

function applyPresetToConfig(cfg, presetId, options = {}) {
  const p = PRESETS[presetId];
  if (!p) throw new Error(`Unknown preset "${presetId}". Valid: ${Object.keys(PRESETS).join(", ")}`);
  const next = mergeConfig(cfg);
  next.preset = presetId;
  if (options.updateActiveProfile !== false) {
    next.activeProfile = options.activeProfile || presetId;
  }
  const curSub = String(next.loading.subtitle || "").trim();
  if (!curSub || curSub === "Preparing Kanagawa workspace..." || /^Ready for .+\.\.\.$/.test(curSub)) {
    next.loading.subtitle = `Ready for ${p.label}...`;
  }
  next.dark = { ...next.dark, ...p.dark };
  next.light = { ...next.light, ...p.light };
  next.composer = { ...next.composer, ...(p.composer || {}) };
  const curAgentImg = next.agentAvatar && next.agentAvatar.image;
  const promotedImage = isBuiltInGeminiStarUrl(curAgentImg) ? "SVG_STAR" : curAgentImg;
  next.agentAvatar = {
    ...next.agentAvatar,
    image: promotedImage,
    bgStops: [...p.agentAvatar.bgStops],
    iconStops: [...p.agentAvatar.iconStops],
  };
  return next;
}

function resolveImageToUrlAndRef(themeDir, spec, fallbackEmbeddedUrl, prefix) {
  const resolved = resolveAssetSpec(themeDir, spec);
  if (resolved.kind === "none") return { url: null, ref: "NONE" };
  if (resolved.kind === "same") return { url: null, ref: "SAME", same: true };
  if (resolved.kind === "svg_star") return { url: null, ref: "SVG_STAR", svgStar: true };
  if (resolved.kind === "keep" || resolved.kind === "empty") {
    if (!fallbackEmbeddedUrl) return { url: null, ref: "NONE" };
    return { url: fallbackEmbeddedUrl, ref: spec || "KEEP_EMBEDDED" };
  }
  if (resolved.kind === "inline") {
    const libRef = dataUrlWrapperToLibrary(themeDir, resolved.value, prefix);
    return { url: resolved.value, ref: libRef || "KEEP_EMBEDDED" };
  }
  if (resolved.kind === "file") {
    if (!fs.existsSync(resolved.path)) {
      if (resolved.ref) {
        return { url: null, ref: "NONE" };
      }
    }
    const url = fileToDataUrl(resolved.path);
    const ref = resolved.ref || importAssetToLibrary(themeDir, resolved.path, prefix);
    return { url, ref };
  }
  return { url: fallbackEmbeddedUrl || null, ref: fallbackEmbeddedUrl ? "KEEP_EMBEDDED" : "NONE" };
}

function stripManagedBlock(css, tag) {
  const esc = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let next = css.replace(
    new RegExp(`(?:\\r?\\n)*\\/\\* === ${esc}-START === \\*\\/[\\s\\S]*?\\/\\* === ${esc}-END === \\*\\/[ \\t]*(?:\\r?\\n)*`, "g"),
    "\n"
  );
  // Recover cleanly if a prior file was truncated and left an unclosed START marker
  next = next.replace(
    new RegExp(`(?:\\r?\\n)*\\/\\* === ${esc}-START === \\*\\/[\\s\\S]*?(?=(?:\\r?\\n)*\\/\\* === KANAGAWA-|$)`, "g"),
    "\n"
  );
  return next;
}

function applyThemeConfig(themeDir, inputCfg, options = {}) {
  const cssPath = path.join(themeDir, "kanagawa.css");
  const configPath = path.join(themeDir, "kanagawa.config.json");
  const loadingPath = path.join(themeDir, "loading.html");

  let css = fs.readFileSync(cssPath, "utf8");
  const cfg = mergeConfig(inputCfg);

  // Only seed KEEP_EMBEDDED slots unless explicitly asked to seed all
  const embedded = extractEmbeddedFromCss(css);
  const keepSlots = new Set();
  if (cfg.wallpaper === "KEEP_EMBEDDED") keepSlots.add("wallpaper");
  if (cfg.wallpaperLight === "KEEP_EMBEDDED") keepSlots.add("wallpaperLight");
  if (cfg.userAvatar === "KEEP_EMBEDDED") keepSlots.add("userAvatar");
  if (cfg.agentAvatar.image === "KEEP_EMBEDDED") keepSlots.add("agentAvatar");

  const seeded = (options.seedAll && !options.dryRun)
    ? seedLibraryFromCss(themeDir, css, null)
    : (options.seedLibrary !== false && !options.dryRun && keepSlots.size > 0)
      ? seedLibraryFromCss(themeDir, css, keepSlots)
      : {};
  if (cfg.wallpaper === "KEEP_EMBEDDED" && seeded.wallpaper) cfg.wallpaper = seeded.wallpaper;
  if (cfg.wallpaperLight === "KEEP_EMBEDDED" && seeded.wallpaperLight) cfg.wallpaperLight = seeded.wallpaperLight;
  if (cfg.userAvatar === "KEEP_EMBEDDED" && seeded.userAvatar) cfg.userAvatar = seeded.userAvatar;
  if (cfg.agentAvatar.image === "KEEP_EMBEDDED" && seeded.agentAvatar) cfg.agentAvatar.image = seeded.agentAvatar;

  // 1. Update :root palette & chrome vars
  const varUpdates = computeRootPaletteVars(cfg);
  for (const [k, v] of Object.entries(varUpdates)) {
    if (v) css = replaceCssVar(css, k, v);
  }

  // 2. Resolve wallpaper (dark + optional light) and avatars
  const wpDark = resolveImageToUrlAndRef(themeDir, cfg.wallpaper, embedded.wpUrl, "wp");
  cfg.wallpaper = wpDark.ref;

  let wpLightUrl = null;
  let wpLightMode = "same";
  const wpLightSpec = resolveAssetSpec(themeDir, cfg.wallpaperLight);
  if (wpLightSpec.kind === "same" || wpLightSpec.kind === "empty") {
    cfg.wallpaperLight = "SAME";
    wpLightMode = "same";
  } else if (wpLightSpec.kind === "none") {
    cfg.wallpaperLight = "NONE";
    wpLightMode = "none";
  } else if (wpLightSpec.kind === "keep" && !embedded.wpLightUrl) {
    cfg.wallpaperLight = "SAME";
    wpLightMode = "same";
  } else {
    const wpL = resolveImageToUrlAndRef(themeDir, cfg.wallpaperLight, embedded.wpLightUrl, "wp-light");
    cfg.wallpaperLight = wpL.ref;
    wpLightUrl = wpL.url;
    wpLightMode = wpLightUrl ? "custom" : "none";
  }

  const ua = resolveImageToUrlAndRef(themeDir, cfg.userAvatar, embedded.uaUrl, "user");
  cfg.userAvatar = ua.ref;

  let aaUrl = null;
  const aaSpec = resolveAssetSpec(themeDir, cfg.agentAvatar.image);
  if (
    aaSpec.kind === "svg_star" ||
    (aaSpec.kind === "keep" && isBuiltInGeminiStarUrl(embedded.aaUrl)) ||
    (aaSpec.kind === "inline" && isBuiltInGeminiStarUrl(aaSpec.value))
  ) {
    aaUrl = buildGeminiStarSvgUrl(cfg.agentAvatar.bgStops, cfg.agentAvatar.iconStops);
    cfg.agentAvatar.image = "SVG_STAR";
  } else if (aaSpec.kind === "none") {
    aaUrl = null;
    cfg.agentAvatar.image = "NONE";
  } else {
    const aa = resolveImageToUrlAndRef(themeDir, cfg.agentAvatar.image, embedded.aaUrl, "agent");
    cfg.agentAvatar.image = aa.ref;
    aaUrl = aa.url;
  }

  // 3. Strip prior managed blocks (CRLF & malformed-END safe)
  css = css.replace(/(?:\r?\n)*\/\* Embedded wallpaper[^\r\n]*\*\/\s*:root\s*\{[\s\S]*?\}\s*$/, "");
  css = stripManagedBlock(css, "KANAGAWA-EMBEDDED-ASSETS");
  css = stripManagedBlock(css, "KANAGAWA-CUSTOM-SURFACE");
  css = stripManagedBlock(css, "KANAGAWA-USER-CUSTOM-CSS");

  // 4. Append KANAGAWA-CUSTOM-SURFACE
  const surfaceBlock = buildSurfaceOverrideBlock(cfg);
  css = css.trimEnd() + "\n\n" + surfaceBlock;

  // 5. Append KANAGAWA-EMBEDDED-ASSETS (direct rules outside CSS variables to bypass Chromium ~2MB var limit)
  const assetRules = ["/* === KANAGAWA-EMBEDDED-ASSETS-START === */"];
  if (wpDark.url) {
    assetRules.push(
      `html::before {\n  content: "";\n  position: fixed;\n  inset: 0;\n  z-index: 0 !important;\n  pointer-events: none;\n  will-change: transform, filter;\n  transform: translateZ(0) scale(var(--kn-wp-scale, 1));\n  filter: var(--kn-wp-filter, none);\n  opacity: var(--kn-wp-opacity, 1);\n  background-image: ${wpDark.url};\n  background-size: var(--kn-wp-size, cover);\n  background-position: var(--kn-wp-pos, right top);\n  background-repeat: no-repeat;\n}`
    );
  } else {
    assetRules.push(
      `html::before {\n  content: "";\n  position: fixed;\n  inset: 0;\n  z-index: 0 !important;\n  pointer-events: none;\n  opacity: 1;\n  filter: none;\n  transform: none;\n  background-image: none;\n  background-color: rgb(var(--kn-d-chrome-rgb));\n}`
    );
  }

  const lightHtmlBeforeSel = "html:has(> body.theme-light, > body > .monaco-workbench:is(.vs:not(.vs-dark), .hc-light))::before";
  if (wpLightMode === "custom" && wpLightUrl) {
    assetRules.push(
      `${lightHtmlBeforeSel} {\n  will-change: transform, filter;\n  transform: translateZ(0) scale(var(--kn-wp-scale, 1)) !important;\n  filter: var(--kn-wp-filter, none) !important;\n  opacity: var(--kn-wp-opacity, 1) !important;\n  background-image: ${wpLightUrl} !important;\n  background-size: var(--kn-wp-size, cover) !important;\n  background-position: var(--kn-wp-pos-light, right top) !important;\n  background-repeat: no-repeat !important;\n}`
    );
  } else if (wpLightMode === "none" || !wpDark.url) {
    assetRules.push(
      `${lightHtmlBeforeSel} {\n  opacity: 1 !important;\n  filter: none !important;\n  transform: none !important;\n  background-image: none !important;\n  background-color: rgb(var(--kn-l-chrome-rgb)) !important;\n}`
    );
  } else {
    assetRules.push(
      `${lightHtmlBeforeSel} {\n  background-position: var(--kn-wp-pos-light, right top) !important;\n}`
    );
  }

  if (aaUrl) {
    assetRules.push(
      `html body [data-testid="agent-response"] div:has(> [data-markdown-root])::before {\n  background-image: ${aaUrl} !important;\n}`
    );
  } else {
    assetRules.push(
      `html body [data-testid="agent-response"] div:has(> [data-markdown-root])::before {\n  background-image: none !important;\n}`
    );
  }
  if (ua.url) {
    assetRules.push(
      `html body :is(.agy-user-bubble-frame, [class*="group/user-input-step"] [class*="bg-card-border"], [data-testid="user-input-step"] [class*="bg-card-border"]):has([data-testid="user-message-bubble"])::before {\n  background-image: ${ua.url} !important;\n}`
    );
  } else {
    assetRules.push(
      `html body :is(.agy-user-bubble-frame, [class*="group/user-input-step"] [class*="bg-card-border"], [data-testid="user-input-step"] [class*="bg-card-border"]):has([data-testid="user-message-bubble"])::before {\n  background-image: none !important;\n}`
    );
  }
  assetRules.push("/* === KANAGAWA-EMBEDDED-ASSETS-END === */");
  css = css.trimEnd() + "\n\n" + assetRules.join("\n\n");

  // 6. Append user custom.css
  const customCss = (options.customCss !== undefined ? String(options.customCss) : readCustomCss(themeDir, !options.dryRun)).trim();
  if (customCss) {
    css = css.trimEnd() + "\n\n/* === KANAGAWA-USER-CUSTOM-CSS-START === */\n" + customCss + "\n/* === KANAGAWA-USER-CUSTOM-CSS-END === */\n";
  } else {
    css = css.trimEnd() + "\n";
  }

  const braces = countBracesOutsideCommentsAndStrings(css);
  if (braces.open !== braces.close) {
    throw new Error(`Refusing to write unbalanced CSS: open=${braces.open} close=${braces.close}`);
  }

  const loadingHtml = buildLoadingHtml(cfg);

  if (!options.dryRun) {
    if (options.customCss !== undefined) {
      fs.writeFileSync(path.join(themeDir, "custom.css"), String(options.customCss), "utf8");
    }
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
    fs.writeFileSync(cssPath, css, "utf8");
    fs.writeFileSync(loadingPath, loadingHtml, "utf8");
  }

  return { cfg, css, loadingHtml, braces };
}

function slugifyProfileId(name) {
  const s = String(name || "").toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return s || `profile-${Date.now().toString(36)}`;
}

function deleteLibraryAsset(themeDir, idOrName) {
  const filename = String(idOrName || "").replace(/^library:/, "").replace(/[\\/]/g, "");
  if (!filename) return false;
  const full = path.join(getLibraryDir(themeDir), filename);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
    return true;
  }
  return false;
}

const BUILT_IN_PROFILE_IDS = new Set([
  ...Object.keys(PRESETS),
  "frosted-glass",
  "minimal-clean",
]);

function readJsonSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch {
    // Ignore malformed JSON
  }
  return null;
}

function ensureDefaultProfiles(themeDir, currentCfg, options = {}) {
  const dir = getProfilesDir(themeDir);
  ensureDir(dir);
  const existingFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const hadProfiles = existingFiles.length > 0;
  const force = Boolean(options && options.force);

  const cur = mergeConfig(currentCfg);
  const curKeepSlots = new Set();
  if (cur.wallpaper === "KEEP_EMBEDDED") curKeepSlots.add("wallpaper");
  if (cur.wallpaperLight === "KEEP_EMBEDDED") curKeepSlots.add("wallpaperLight");
  if (cur.userAvatar === "KEEP_EMBEDDED") curKeepSlots.add("userAvatar");
  if (cur.agentAvatar.image === "KEEP_EMBEDDED") curKeepSlots.add("agentAvatar");

  const cssPath = path.join(themeDir, "kanagawa.css");
  if (curKeepSlots.size > 0 && fs.existsSync(cssPath)) {
    const seeded = seedLibraryFromCss(themeDir, fs.readFileSync(cssPath, "utf8"), curKeepSlots);
    if (cur.wallpaper === "KEEP_EMBEDDED" && seeded.wallpaper) cur.wallpaper = seeded.wallpaper;
    if (cur.wallpaperLight === "KEEP_EMBEDDED" && seeded.wallpaperLight) cur.wallpaperLight = seeded.wallpaperLight;
    if (cur.userAvatar === "KEEP_EMBEDDED" && seeded.userAvatar) cur.userAvatar = seeded.userAvatar;
    if (cur.agentAvatar.image === "KEEP_EMBEDDED" && seeded.agentAvatar) cur.agentAvatar.image = seeded.agentAvatar;
  }

  const writeProfile = (id, name, description, cfg, meta = {}) => {
    const filePath = path.join(dir, `${id}.json`);
    if (!force && fs.existsSync(filePath)) return;
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          id,
          name,
          description,
          builtIn: meta.builtIn !== false,
          preserveWallpaper: Boolean(meta.preserveWallpaper),
          preserveAvatars: Boolean(meta.preserveAvatars),
          updatedAt: new Date().toISOString(),
          config: cfg,
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
  };

  // Preserve the user's initial active setup once when profiles/ is newly initialized
  if (!hadProfiles && cur.wallpaper && cur.wallpaper !== "NONE") {
    const myCur = cloneDeep(cur);
    myCur.activeProfile = "my-current";
    writeProfile("my-current", "My Current Setup", "Your active wallpaper & theme setup", myCur, {
      builtIn: false,
      preserveWallpaper: false,
      preserveAvatars: false,
    });
  }

  // Clean base template for built-in look profiles (never bake user wallpapers/avatars/tweaks into presets)
  const template = defaultConfig();
  template.wallpaper = "KEEP_EMBEDDED";
  template.wallpaperLight = "SAME";
  template.userAvatar = "KEEP_EMBEDDED";
  template.agentAvatar.image = "SVG_STAR";

  for (const [id, p] of Object.entries(PRESETS)) {
    const c = applyPresetToConfig(template, id, { activeProfile: id });
    c.loading.subtitle = `Ready for ${p.label}...`;
    writeProfile(id, p.label, `${p.label} palette`, c, {
      builtIn: true,
      preserveWallpaper: true,
      preserveAvatars: true,
    });
  }

  // Curated Frosted Glass profile
  const frosted = applyPresetToConfig(template, "midnight-aqua", { activeProfile: "frosted-glass" });
  frosted.loading.subtitle = "Ready for Frosted Glass...";
  frosted.surfaces.glassBlur = 14;
  frosted.surfaces.glassSaturate = 155;
  frosted.surfaces.sidebarOpacity = 42;
  frosted.surfaces.panelOpacity = 28;
  frosted.surfaces.chatOpacity = 46;
  frosted.surfaces.composerOpacity = 34;
  frosted.wallpaperEffects.scrimOpacity = 45;
  writeProfile("frosted-glass", "Frosted Glass", "Translucent blur glass over crisp wallpaper", frosted, {
    builtIn: true,
    preserveWallpaper: true,
    preserveAvatars: true,
  });

  // Curated Minimal Clean (no wallpaper, clean straight circle avatars)
  const minimal = applyPresetToConfig(template, "kanagawa-dragon", { activeProfile: "minimal-clean" });
  minimal.loading.subtitle = "Ready for Minimal Clean...";
  minimal.wallpaper = "NONE";
  minimal.wallpaperLight = "NONE";
  minimal.avatars.userRotate = 0;
  minimal.avatars.agentRotate = 0;
  minimal.avatars.userRadius = 50;
  minimal.avatars.agentRadius = 50;
  minimal.surfaces.sidebarOpacity = 92;
  minimal.surfaces.panelOpacity = 94;
  minimal.surfaces.chatOpacity = 92;
  writeProfile("minimal-clean", "Minimal Clean", "Solid dragon palette, circle straight avatars", minimal, {
    builtIn: true,
    preserveWallpaper: false,
    preserveAvatars: true,
  });
}

function listProfiles(themeDir) {
  const dir = getProfilesDir(themeDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        const id = p.id || path.basename(f, ".json");
        const cfg = mergeConfig(p.config || p);
        return {
          id,
          name: p.name || id,
          description: p.description || "",
          builtIn: Boolean(p.builtIn),
          preserveWallpaper: Boolean(p.preserveWallpaper),
          preserveAvatars: Boolean(p.preserveAvatars),
          updatedAt: p.updatedAt || "",
          swatch: [
            cfg.dark.chromeBg,
            cfg.dark.primary,
            cfg.dark.accentAqua,
            cfg.dark.accentBlue,
            cfg.dark.accentPink,
          ],
          wallpaper: cfg.wallpaper,
          glassBlur: cfg.surfaces.glassBlur,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function findProfileFilePath(themeDir, id) {
  const dir = getProfilesDir(themeDir);
  const rawId = String(id || "").trim();
  const safeId = slugifyProfileId(rawId);
  const direct = path.join(dir, `${safeId}.json`);
  if (fs.existsSync(direct)) return { filePath: direct, resolvedId: safeId };
  if (!fs.existsSync(dir)) return null;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const stem = path.basename(f, ".json");
    const full = path.join(dir, f);
    const parsed = readJsonSafe(full);
    const metaId = parsed && parsed.id ? String(parsed.id) : stem;
    if (stem === rawId || metaId === rawId || slugifyProfileId(metaId) === safeId) {
      return { filePath: full, resolvedId: metaId };
    }
  }
  return null;
}

function isNoneAssetRef(spec) {
  return /^(NONE|off|false)$/i.test(String(spec || "").trim());
}

function findFallbackWallpaperRef(themeDir, excludeIds = new Set()) {
  const myCur = readJsonSafe(path.join(getProfilesDir(themeDir), "my-current.json"));
  const myWp = myCur && myCur.config && myCur.config.wallpaper;
  if (myWp && !isNoneAssetRef(myWp) && myWp !== "KEEP_EMBEDDED") {
    return {
      wallpaper: myWp,
      wallpaperLight: myCur.config.wallpaperLight || "SAME",
      wallpaperPosition: myCur.config.wallpaperPosition,
      wallpaperPositionLight: myCur.config.wallpaperPositionLight,
      wallpaperFit: myCur.config.wallpaperFit,
    };
  }
  const assets = listLibraryAssets(themeDir);
  const nonAvatar = assets.filter((a) => !/(?:^|[-_])avatar/i.test(a.filename) && !excludeIds.has(a.id));
  const libWp = nonAvatar.find((a) => /^(wp|wallpaper)/i.test(a.filename))
    || nonAvatar[0]
    || assets.find((a) => !/(?:^|[-_])avatar/i.test(a.filename));
  if (libWp) {
    return { wallpaper: libWp.id, wallpaperLight: "SAME" };
  }
  return null;
}

function loadProfile(themeDir, id, currentCfg = null) {
  const found = findProfileFilePath(themeDir, id);
  const safeId = slugifyProfileId(id);
  if (!found) {
    throw new Error(`Profile not found: ${safeId}`);
  }
  const raw = JSON.parse(fs.readFileSync(found.filePath, "utf8"));
  const cfg = mergeConfig(raw.config || raw);
  cfg.activeProfile = found.resolvedId || raw.id || safeId;

  const diskRaw = currentCfg ? null : readJsonSafe(path.join(themeDir, "kanagawa.config.json"));
  const activeCur = currentCfg ? mergeConfig(currentCfg) : (diskRaw ? mergeConfig(diskRaw) : null);

  if (raw.preserveWallpaper && activeCur) {
    if (isNoneAssetRef(activeCur.wallpaper) && activeCur.activeProfile === "minimal-clean") {
      const exclude = new Set([activeCur.userAvatar, activeCur.agentAvatar && activeCur.agentAvatar.image].filter(Boolean));
      const restored = findFallbackWallpaperRef(themeDir, exclude);
      if (restored) {
        cfg.wallpaper = restored.wallpaper;
        cfg.wallpaperLight = restored.wallpaperLight;
        if (restored.wallpaperPosition) cfg.wallpaperPosition = restored.wallpaperPosition;
        if (restored.wallpaperPositionLight) cfg.wallpaperPositionLight = restored.wallpaperPositionLight;
        if (restored.wallpaperFit) cfg.wallpaperFit = restored.wallpaperFit;
      }
    } else {
      cfg.wallpaper = activeCur.wallpaper;
      cfg.wallpaperLight = activeCur.wallpaperLight;
      cfg.wallpaperPosition = activeCur.wallpaperPosition;
      cfg.wallpaperPositionLight = activeCur.wallpaperPositionLight;
      cfg.wallpaperFit = activeCur.wallpaperFit;
    }
  }

  if (raw.preserveAvatars && activeCur) {
    cfg.userAvatar = activeCur.userAvatar;
    cfg.agentAvatar.image = activeCur.agentAvatar.image;
    cfg.avatars.userVisible = activeCur.avatars.userVisible;
    cfg.avatars.agentVisible = activeCur.avatars.agentVisible;
  }

  return { meta: raw, config: cfg };
}

function saveProfile(themeDir, name, cfg, options = {}) {
  const dir = getProfilesDir(themeDir);
  ensureDir(dir);
  const id = options.id ? slugifyProfileId(options.id) : slugifyProfileId(name);
  const targetPath = path.join(dir, `${id}.json`);
  const existing = readJsonSafe(targetPath);
  if ((BUILT_IN_PROFILE_IDS.has(id) || (existing && existing.builtIn === true)) && !options.builtIn && !options.force) {
    throw new Error(`Built-in profile "${id}" cannot be overwritten; save under a new name.`);
  }
  const nextCfg = mergeConfig(cfg);
  nextCfg.activeProfile = id;
  const payload = {
    id,
    name: String(name || id).trim() || id,
    description: options.description !== undefined
      ? String(options.description || "").trim()
      : String((existing && existing.description) || "").trim(),
    builtIn: options.builtIn !== undefined
      ? Boolean(options.builtIn)
      : Boolean(existing && existing.builtIn),
    preserveWallpaper: options.preserveWallpaper !== undefined
      ? Boolean(options.preserveWallpaper)
      : Boolean(existing && existing.preserveWallpaper),
    preserveAvatars: options.preserveAvatars !== undefined
      ? Boolean(options.preserveAvatars)
      : Boolean(existing && existing.preserveAvatars),
    updatedAt: new Date().toISOString(),
    config: nextCfg,
  };
  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return payload;
}

function deleteProfile(themeDir, id) {
  const found = findProfileFilePath(themeDir, id);
  if (found && fs.existsSync(found.filePath)) {
    fs.unlinkSync(found.filePath);
    return true;
  }
  return false;
}

module.exports = {
  MIME_MAP,
  PRESETS,
  defaultConfig,
  mergeConfig,
  hexToRgb,
  sanitizeHex,
  applyPresetToConfig,
  importAssetToLibrary,
  saveDataUrlToLibrary,
  seedLibraryFromCss,
  listLibraryAssets,
  deleteLibraryAsset,
  extractEmbeddedFromCss,
  buildSurfaceOverrideBlock,
  buildLoadingHtml,
  ensureCustomCssFile,
  readCustomCss,
  applyThemeConfig,
  ensureDefaultProfiles,
  listProfiles,
  loadProfile,
  saveProfile,
  deleteProfile,
  slugifyProfileId,
};

#!/usr/bin/env node
/**
 * CLI frontend for Antigravity Theme customization.
 * Delegates config merging, CSS generation, asset embedding, and profile management
 * to kanagawa-theme/theme-builder.js.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const tb = require("../kanagawa-theme/theme-builder.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const THEME_DIR = path.join(REPO_ROOT, "kanagawa-theme");
const CONFIG_PATH = path.join(THEME_DIR, "kanagawa.config.json");

const FLAG_ONLY = new Set([
  "help",
  "list-presets",
  "list-profiles",
  "dry-run",
  "no-wallpaper",
  "seed-only",
]);

const FX_MAP = {
  "wp-blur": "blur",
  "wp-brightness": "brightness",
  "wp-contrast": "contrast",
  "wp-saturate": "saturate",
  "wp-opacity": "opacity",
  "wp-scale": "scale",
  "scrim-opacity": "scrimOpacity",
};

const SURF_MAP = {
  "sidebar-opacity": "sidebarOpacity",
  "panel-opacity": "panelOpacity",
  "chat-opacity": "chatOpacity",
  "user-bubble-opacity": "userBubbleOpacity",
  "composer-opacity": "composerOpacity",
  "code-opacity": "codeOpacity",
  "editor-opacity": "editorOpacity",
  "overlay-opacity": "overlayOpacity",
  "titlebar-opacity": "titlebarOpacity",
  "glass-blur": "glassBlur",
  "glass-saturate": "glassSaturate",
  "panel-radius": "panelRadius",
  "card-radius": "cardRadius",
  "composer-radius": "composerRadius",
  "bubble-radius": "bubbleRadius",
};

const VALUE_OPTIONS = new Set([
  "profile",
  "save-profile",
  "preset",
  "wallpaper",
  "wallpaper-light",
  "wallpaper-pos",
  "wallpaper-pos-light",
  "wallpaper-fit",
  "scrim-style",
  "user-avatar",
  "agent-avatar",
  "user-avatar-visible",
  "agent-avatar-visible",
  "avatar-size",
  "user-avatar-size",
  "agent-avatar-size",
  "avatar-radius",
  "user-avatar-radius",
  "agent-avatar-radius",
  "avatar-rotate",
  "user-avatar-rotate",
  "agent-avatar-rotate",
  "dark-primary",
  "dark-blue",
  "dark-aqua",
  "dark-surface",
  "dark-chrome",
  "dark-sidebar",
  "dark-overlay",
  "dark-scrim",
  "dark-selection",
  "light-primary",
  "light-chrome",
  "light-surface",
  "ui-font",
  "mono-font",
  "chat-font-size",
  "code-font-size",
  "line-height",
  "loading-title",
  "loading-subtitle",
  "loading-style",
  "loading-show-emblem",
  "loading-show-progress",
  "studio-pill",
  "studio-pill-pos",
  "studio-lang",
  ...Object.keys(FX_MAP),
  ...Object.keys(SURF_MAP),
]);

function printUsage() {
  console.log(`Usage: node scripts/apply_kanagawa_config.js [options]

Discovery & Utility:
  -h, --help                     Show this help message and exit
  --list-presets                 Print available built-in palette presets
  --list-profiles                Print saved profiles in kanagawa-theme/profiles/
  --seed-only                    Seed library/profiles & recompile CSS/HTML
  --dry-run                      Compile without modifying files on disk

Profiles & Presets:
  --profile <id>                 Load profile by ID (preserving look settings)
  --preset <id>                  Apply palette preset (${Object.keys(tb.PRESETS).join(", ")})
  --save-profile <name>          Save resulting config as a custom profile

Wallpaper & Scrim:
  --no-wallpaper                 Disable dark wallpaper (sets wallpaper="NONE")
  --wallpaper <path|library:..>  Set dark wallpaper (or NONE / KEEP_EMBEDDED)
  --wallpaper-light <spec>       Set light wallpaper (SAME / NONE / path / library:...)
  --wallpaper-pos <pos>          CSS background-position for dark mode
  --wallpaper-pos-light <pos>    CSS background-position for light mode (or SAME)
  --wallpaper-fit <fit>          cover | contain | auto | "100% 100%"
  --wp-blur <0-40>               Blur radius in px
  --wp-brightness <20-200>       Brightness percentage
  --wp-contrast <30-200>         Contrast percentage
  --wp-saturate <0-250>          Saturation percentage
  --wp-opacity <0-100>           Wallpaper opacity percentage
  --wp-scale <100-200>           Wallpaper scale percentage
  --scrim-opacity <0-100>        Scrim veil opacity percentage
  --scrim-style <style>          none | directional | solid | uniform | vignette | gradient

Surfaces, Radii & Glass:
  --sidebar-opacity <0-100>      --panel-opacity <0-100>       --chat-opacity <0-100>
  --user-bubble-opacity <0-100>  --composer-opacity <0-100>    --code-opacity <0-100>
  --editor-opacity <0-100>       --overlay-opacity <45-100>    --titlebar-opacity <0-100>
  --glass-blur <0-32>            --glass-saturate <80-220>
  --panel-radius <0-32>          --card-radius <0-32>
  --composer-radius <0-32>       --bubble-radius <0-32>

Avatars:
  --user-avatar <spec>           --agent-avatar <spec> (NONE | SVG_STAR | path | library:..)
  --user-avatar-visible <bool>   --agent-avatar-visible <bool>
  --avatar-size <18-64>          --user-avatar-size <18-64>    --agent-avatar-size <18-64>
  --avatar-radius <0-50>         --user-avatar-radius <0-50>  --agent-avatar-radius <0-50>
  --avatar-rotate <-45..45>      --user-avatar-rotate <-45..45> --agent-avatar-rotate <-45..45>

Colors & Typography:
  --dark-primary <hex>           --dark-blue <hex>             --dark-aqua <hex>
  --dark-surface <hex>           --dark-chrome <hex>           --dark-sidebar <hex>
  --dark-overlay <hex>           --dark-scrim <hex>            --dark-selection <hex>
  --light-primary <hex>          --light-chrome <hex>          --light-surface <hex>
  --ui-font <font-list>          --mono-font <font-list>
  --chat-font-size <0|10-26>     --code-font-size <0|9-24>     --line-height <1.15-2.2>

Loading & Studio:
  --loading-title <text>         --loading-subtitle <text>
  --loading-style <style>        kanagawa-wave | minimal | terminal
  --loading-show-emblem <bool>   --loading-show-progress <bool>
  --studio-pill <bool>           --studio-pill-pos <bottom-right|bottom-left|top-right>
  --studio-lang <vi|en>`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      out.help = true;
      continue;
    }
    if (!a.startsWith("--")) {
      throw new Error(`Unexpected positional argument: "${a}". Use --help for usage.`);
    }
    const raw = a.slice(2);
    const eqIdx = raw.indexOf("=");
    if (eqIdx !== -1) {
      const key = raw.slice(0, eqIdx);
      const val = raw.slice(eqIdx + 1);
      if (FLAG_ONLY.has(key)) {
        throw new Error(`Flag --${key} does not take a value`);
      }
      if (!VALUE_OPTIONS.has(key)) {
        throw new Error(`Unknown option: --${key}. Use --help for usage.`);
      }
      out[key] = val;
      continue;
    }
    if (FLAG_ONLY.has(raw)) {
      out[raw] = true;
      continue;
    }
    if (!VALUE_OPTIONS.has(raw)) {
      throw new Error(`Unknown option: --${raw}. Use --help for usage.`);
    }
    if (i + 1 >= argv.length || (argv[i + 1].startsWith("--") && (FLAG_ONLY.has(argv[i + 1].slice(2)) || VALUE_OPTIONS.has(argv[i + 1].slice(2).split("=")[0])))) {
      throw new Error(`Missing value for --${raw}`);
    }
    out[raw] = argv[i + 1];
    i++;
  }
  return out;
}

function parseBool(v, flagName) {
  const s = String(v).trim().toLowerCase();
  if (/^(1|true|yes|on)$/.test(s)) return true;
  if (/^(0|false|no|off)$/.test(s)) return false;
  throw new Error(`Invalid boolean for --${flagName}: "${v}" (expected true/false)`);
}

function parseFiniteNumber(v, flagName) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`Invalid numeric value for --${flagName}: "${v}"`);
  const n = Number(s);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid numeric value for --${flagName}: "${v}"`);
  }
  return n;
}

function parseStrictHex(v, flagName) {
  const hex = tb.sanitizeHex(v, null);
  if (!hex) {
    throw new Error(`Invalid hex color for --${flagName}: "${v}" (expected #RRGGBB or #RGB)`);
  }
  return hex;
}

function parseEnum(v, allowed, flagName) {
  const s = String(v ?? "").trim();
  if (!allowed.includes(s)) {
    throw new Error(`Invalid value for --${flagName}: "${v}". Allowed: ${allowed.join(", ")}`);
  }
  return s;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (args["list-presets"]) {
    for (const [id, p] of Object.entries(tb.PRESETS)) {
      console.log(`${id}\t${p.label}`);
    }
    return;
  }

  let rawCfg = {};
  if (fs.existsSync(CONFIG_PATH)) {
    rawCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8").replace(/^\uFEFF/, ""));
  }
  let cfg = tb.mergeConfig(rawCfg);
  if (!args["dry-run"]) {
    tb.ensureCustomCssFile(THEME_DIR);
    tb.ensureDefaultProfiles(THEME_DIR, cfg);
  }

  if (args["list-profiles"]) {
    const profiles = tb.listProfiles(THEME_DIR);
    for (const p of profiles) {
      console.log(`${p.id}\t${p.name}\t${p.description}`);
    }
    return;
  }

  if (args["seed-only"]) {
    const res = tb.applyThemeConfig(THEME_DIR, cfg, { dryRun: Boolean(args["dry-run"]) });
    console.log(`[kanagawa] Seeded library & profiles -> ${res.braces.open}/${res.braces.close} braces`);
    return;
  }

  if (args.profile) {
    cfg = tb.loadProfile(THEME_DIR, args.profile, cfg).config;
  }

  if (args.preset) {
    cfg = tb.applyPresetToConfig(cfg, args.preset);
  }

  if (args["no-wallpaper"]) cfg.wallpaper = "NONE";
  else if (args.wallpaper !== undefined) cfg.wallpaper = args.wallpaper;
  if (args["wallpaper-light"] !== undefined) cfg.wallpaperLight = args["wallpaper-light"];
  if (args["wallpaper-pos"] !== undefined) cfg.wallpaperPosition = args["wallpaper-pos"];
  if (args["wallpaper-pos-light"] !== undefined) cfg.wallpaperPositionLight = args["wallpaper-pos-light"];
  if (args["wallpaper-fit"] !== undefined) {
    cfg.wallpaperFit = parseEnum(args["wallpaper-fit"], ["cover", "contain", "auto", "100% 100%"], "wallpaper-fit");
  }

  for (const [flag, key] of Object.entries(FX_MAP)) {
    if (args[flag] !== undefined) cfg.wallpaperEffects[key] = parseFiniteNumber(args[flag], flag);
  }
  if (args["scrim-style"] !== undefined) {
    cfg.wallpaperEffects.scrimStyle = parseEnum(
      args["scrim-style"].toLowerCase(),
      ["none", "directional", "solid", "uniform", "vignette", "gradient"],
      "scrim-style"
    );
  }

  for (const [flag, key] of Object.entries(SURF_MAP)) {
    if (args[flag] !== undefined) cfg.surfaces[key] = parseFiniteNumber(args[flag], flag);
  }

  if (args["user-avatar"] !== undefined) cfg.userAvatar = args["user-avatar"];
  if (args["agent-avatar"] !== undefined) cfg.agentAvatar.image = args["agent-avatar"];
  if (args["user-avatar-visible"] !== undefined) cfg.avatars.userVisible = parseBool(args["user-avatar-visible"], "user-avatar-visible");
  if (args["agent-avatar-visible"] !== undefined) cfg.avatars.agentVisible = parseBool(args["agent-avatar-visible"], "agent-avatar-visible");

  if (args["avatar-size"] !== undefined) {
    const sz = parseFiniteNumber(args["avatar-size"], "avatar-size");
    cfg.avatars.userSize = sz;
    cfg.avatars.agentSize = sz;
  }
  if (args["user-avatar-size"] !== undefined) cfg.avatars.userSize = parseFiniteNumber(args["user-avatar-size"], "user-avatar-size");
  if (args["agent-avatar-size"] !== undefined) cfg.avatars.agentSize = parseFiniteNumber(args["agent-avatar-size"], "agent-avatar-size");

  if (args["avatar-radius"] !== undefined) {
    const rad = parseFiniteNumber(args["avatar-radius"], "avatar-radius");
    cfg.avatars.userRadius = rad;
    cfg.avatars.agentRadius = rad;
  }
  if (args["user-avatar-radius"] !== undefined) cfg.avatars.userRadius = parseFiniteNumber(args["user-avatar-radius"], "user-avatar-radius");
  if (args["agent-avatar-radius"] !== undefined) cfg.avatars.agentRadius = parseFiniteNumber(args["agent-avatar-radius"], "agent-avatar-radius");

  if (args["avatar-rotate"] !== undefined) {
    const rot = parseFiniteNumber(args["avatar-rotate"], "avatar-rotate");
    cfg.avatars.userRotate = rot;
    cfg.avatars.agentRotate = -rot;
  }
  if (args["user-avatar-rotate"] !== undefined) cfg.avatars.userRotate = parseFiniteNumber(args["user-avatar-rotate"], "user-avatar-rotate");
  if (args["agent-avatar-rotate"] !== undefined) cfg.avatars.agentRotate = parseFiniteNumber(args["agent-avatar-rotate"], "agent-avatar-rotate");

  if (args["dark-primary"] !== undefined) cfg.dark.primary = parseStrictHex(args["dark-primary"], "dark-primary");
  if (args["dark-blue"] !== undefined) cfg.dark.accentBlue = parseStrictHex(args["dark-blue"], "dark-blue");
  if (args["dark-aqua"] !== undefined) cfg.dark.accentAqua = parseStrictHex(args["dark-aqua"], "dark-aqua");
  if (args["dark-surface"] !== undefined) cfg.dark.surfaceBase = parseStrictHex(args["dark-surface"], "dark-surface");
  if (args["dark-chrome"] !== undefined) cfg.dark.chromeBg = parseStrictHex(args["dark-chrome"], "dark-chrome");
  if (args["dark-sidebar"] !== undefined) cfg.dark.sidebarBase = parseStrictHex(args["dark-sidebar"], "dark-sidebar");
  if (args["dark-overlay"] !== undefined) cfg.dark.overlayBase = parseStrictHex(args["dark-overlay"], "dark-overlay");
  if (args["dark-scrim"] !== undefined) cfg.dark.scrimBase = parseStrictHex(args["dark-scrim"], "dark-scrim");
  if (args["dark-selection"] !== undefined) cfg.dark.selection = parseStrictHex(args["dark-selection"], "dark-selection");
  if (args["light-primary"] !== undefined) cfg.light.primary = parseStrictHex(args["light-primary"], "light-primary");
  if (args["light-chrome"] !== undefined) cfg.light.chromeBg = parseStrictHex(args["light-chrome"], "light-chrome");
  if (args["light-surface"] !== undefined) cfg.light.surfaceBase = parseStrictHex(args["light-surface"], "light-surface");

  if (args["ui-font"] !== undefined) cfg.typography.uiFont = args["ui-font"];
  if (args["mono-font"] !== undefined) cfg.typography.monoFont = args["mono-font"];
  if (args["chat-font-size"] !== undefined) cfg.typography.chatFontSize = parseFiniteNumber(args["chat-font-size"], "chat-font-size");
  if (args["code-font-size"] !== undefined) cfg.typography.codeFontSize = parseFiniteNumber(args["code-font-size"], "code-font-size");
  if (args["line-height"] !== undefined) cfg.typography.lineHeight = parseFiniteNumber(args["line-height"], "line-height");

  if (args["loading-title"] !== undefined) cfg.loading.title = args["loading-title"];
  if (args["loading-subtitle"] !== undefined) cfg.loading.subtitle = args["loading-subtitle"];
  if (args["loading-style"] !== undefined) {
    cfg.loading.style = parseEnum(args["loading-style"].toLowerCase(), ["kanagawa-wave", "minimal", "terminal"], "loading-style");
  }
  if (args["loading-show-emblem"] !== undefined) cfg.loading.showEmblem = parseBool(args["loading-show-emblem"], "loading-show-emblem");
  if (args["loading-show-progress"] !== undefined) cfg.loading.showProgress = parseBool(args["loading-show-progress"], "loading-show-progress");

  if (args["studio-pill"] !== undefined) cfg.studio.showTriggerPill = parseBool(args["studio-pill"], "studio-pill");
  if (args["studio-pill-pos"] !== undefined) {
    cfg.studio.pillPosition = parseEnum(args["studio-pill-pos"].trim().toLowerCase(), ["bottom-right", "bottom-left", "top-right"], "studio-pill-pos");
  }
  if (args["studio-lang"] !== undefined) cfg.studio.language = parseEnum(args["studio-lang"].toLowerCase(), ["vi", "en"], "studio-lang");

  if (args["save-profile"] !== undefined) {
    const saveName = String(args["save-profile"]).trim();
    if (!saveName) throw new Error("Profile name for --save-profile cannot be empty");
    // Validate built-in protection before writing anything to kanagawa.css
    const candidateId = tb.slugifyProfileId(saveName);
    const existingProfiles = tb.listProfiles(THEME_DIR);
    const conflict = existingProfiles.find((p) => p.id === candidateId && p.builtIn);
    if ((tb.BUILT_IN_PROFILE_IDS && tb.BUILT_IN_PROFILE_IDS.has(candidateId)) || conflict) {
      throw new Error(`Built-in profile "${candidateId}" cannot be overwritten; save under a new name.`);
    }
  }

  const result = tb.applyThemeConfig(THEME_DIR, cfg, { dryRun: Boolean(args["dry-run"]) });

  if (args["save-profile"] && !args["dry-run"]) {
    const saved = tb.saveProfile(THEME_DIR, args["save-profile"], result.cfg);
    result.cfg.activeProfile = saved.id;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(result.cfg, null, 2) + "\n", "utf8");
    console.log(`[kanagawa] Saved profile "${saved.name}" (${saved.id})`);
  }

  if (args["dry-run"]) {
    console.log("[dry-run] CSS bytes:", Buffer.byteLength(result.css, "utf8"), "braces:", result.braces.open, "/", result.braces.close);
    console.log("[dry-run] loading.html bytes:", Buffer.byteLength(result.loadingHtml, "utf8"));
    return;
  }

  console.log(`[kanagawa] Applied config -> kanagawa.css (${result.braces.open}/${result.braces.close} braces) & loading.html`);
}

try {
  main();
} catch (err) {
  console.error(`[kanagawa] Error: ${err && err.message ? err.message : String(err)}`);
  process.exit(1);
}

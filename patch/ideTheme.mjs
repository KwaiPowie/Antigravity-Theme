// ============================================================================
// Antigravity Theme Studio — IDE Workbench Hook (ESM)
// Deployed to: %LOCALAPPDATA%\Programs\Antigravity IDE\resources\app\out\kanagawa-ide-hook.mjs
// Links Antigravity IDE directly to %LOCALAPPDATA%\Programs\antigravity\resources\kanagawa-theme\
// so both Agent Manager and Antigravity IDE share the exact same config, CSS, Studio & assets.
// ============================================================================
import electron from "electron";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const { app, dialog, shell, nativeImage } = electron;
const require = createRequire(import.meta.url);

if (!globalThis.__knIdeHookInstalled) {
  globalThis.__knIdeHookInstalled = true;

  const activeIdeWindows = new Map();
  const studioUploadChunks = new Map();
  const MAX_UPLOAD_DATAURL_CHARS = 22 * 1024 * 1024;
  const MAX_UPLOAD_CHUNKS = 512;

  let cachedBuilder = { path: null, mtime: 0, mod: null };
  let cachedStudioJs = { path: null, mtime: 0, size: 0, code: "" };
  let cssReadCache = { path: null, mtime: 0, size: 0, customMtime: 0, customSize: 0, css: "" };
  let themeDirWatcher = null;
  let watchedThemeDir = null;
  let themeReloadDebounce = null;
  let suppressWatchUntil = 0;

  function getAntigravityResourcesDir() {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Local");
    return path.join(localAppData, "Programs", "antigravity", "resources");
  }

  function getThemeDir() {
    const resources = getAntigravityResourcesDir();
    const activeFile = path.join(resources, "active-theme.json");
    if (fs.existsSync(activeFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(activeFile, "utf-8"));
        if (data && data.theme && fs.existsSync(path.join(resources, data.theme))) {
          return path.join(resources, data.theme);
        }
      } catch (_) {}
    }
    return path.join(resources, "kanagawa-theme");
  }

  function findThemeCssFile(themeDir) {
    if (!themeDir || !fs.existsSync(themeDir)) return null;
    const base = path.basename(themeDir).toLowerCase().replace(/-theme$/, "") + ".css";
    const preferred = path.join(themeDir, base);
    if (fs.existsSync(preferred)) return preferred;
    for (const f of ["kanagawa.css", "phantom.css", "matcha.css", "doodle.css", "pixel.css"]) {
      const p = path.join(themeDir, f);
      if (fs.existsSync(p)) return p;
    }
    const anyCss = fs.readdirSync(themeDir).find((f) => f.toLowerCase().endsWith(".css") && f.toLowerCase() !== "custom.css");
    return anyCss ? path.join(themeDir, anyCss) : null;
  }

  function readThemeCss() {
    try {
      const themeDir = getThemeDir();
      const target = findThemeCssFile(themeDir);
      if (!target) return "";
      const st = fs.statSync(target);
      const customCssPath = path.join(themeDir, "custom.css");
      let customMtime = 0;
      let customSize = 0;
      if (fs.existsSync(customCssPath)) {
        try {
          const cst = fs.statSync(customCssPath);
          customMtime = cst.mtimeMs;
          customSize = cst.size;
        } catch (_) {}
      }
      if (
        cssReadCache.path === target &&
        cssReadCache.mtime === st.mtimeMs &&
        cssReadCache.size === st.size &&
        cssReadCache.customMtime === customMtime &&
        cssReadCache.customSize === customSize
      ) {
        return cssReadCache.css;
      }
      let css = fs.readFileSync(target, "utf-8");
      if (customMtime > 0) {
        try {
          const customText = fs.readFileSync(customCssPath, "utf-8").trim();
          css = css.replace(/\n?\/\* === KANAGAWA-USER-CUSTOM-CSS-START === \*\/[\s\S]*?\/\* === KANAGAWA-USER-CUSTOM-CSS-END === \*\/\s*/g, "");
          if (customText) {
            css = css.trimEnd() + "\n\n/* === KANAGAWA-USER-CUSTOM-CSS-START === */\n" + customText + "\n/* === KANAGAWA-USER-CUSTOM-CSS-END === */\n";
          }
        } catch (_) {}
      }
      cssReadCache = { path: target, mtime: st.mtimeMs, size: st.size, customMtime, customSize, css };
      return css;
    } catch (e) {
      console.error("[kanagawa-ide] readThemeCss failed:", e);
      return "";
    }
  }

  function getThemeBuilder(themeDir) {
    try {
      const builderPath = path.join(themeDir, "theme-builder.js");
      if (!fs.existsSync(builderPath)) return null;
      const st = fs.statSync(builderPath);
      if (cachedBuilder.path === builderPath && cachedBuilder.mtime === st.mtimeMs && cachedBuilder.mod) {
        return cachedBuilder.mod;
      }
      try {
        const resolved = require.resolve(builderPath);
        delete require.cache[resolved];
      } catch (_) {}
      const mod = require(builderPath);
      cachedBuilder = { path: builderPath, mtime: st.mtimeMs, mod };
      return mod;
    } catch (e) {
      console.error("[kanagawa-ide] load theme-builder failed:", e);
      return null;
    }
  }

  function loadStudioScript(themeDir) {
    try {
      const studioPath = path.join(themeDir, "studio.js");
      if (!fs.existsSync(studioPath)) return "";
      const st = fs.statSync(studioPath);
      if (cachedStudioJs.path === studioPath && cachedStudioJs.mtime === st.mtimeMs && cachedStudioJs.size === st.size) {
        return cachedStudioJs.code;
      }
      const code = fs.readFileSync(studioPath, "utf-8");
      cachedStudioJs = { path: studioPath, mtime: st.mtimeMs, size: st.size, code };
      return code;
    } catch (e) {
      console.error("[kanagawa-ide] load studio.js failed:", e);
      return "";
    }
  }

  function readRepoLink(themeDir) {
    try {
      const linkPath = path.join(themeDir, "repo-link.json");
      if (!fs.existsSync(linkPath)) return null;
      const data = JSON.parse(fs.readFileSync(linkPath, "utf-8"));
      const repoThemeDir = data && data.themeDir ? path.resolve(data.themeDir) : "";
      if (!repoThemeDir || repoThemeDir === path.resolve(themeDir)) return null;
      if (!fs.existsSync(repoThemeDir) || !fs.existsSync(path.join(repoThemeDir, "theme-builder.js"))) return null;
      return repoThemeDir;
    } catch (_) {
      return null;
    }
  }

  function mirrorToRepo(themeDir, relFiles = [], deletedRelFiles = []) {
    try {
      const repoThemeDir = readRepoLink(themeDir);
      if (!repoThemeDir) return;
      for (const rel of relFiles) {
        if (!rel) continue;
        const src = path.join(themeDir, rel);
        const dst = path.join(repoThemeDir, rel);
        if (!fs.existsSync(src)) continue;
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
      }
      for (const rel of deletedRelFiles) {
        if (!rel) continue;
        const dst = path.join(repoThemeDir, rel);
        if (fs.existsSync(dst)) {
          try { fs.unlinkSync(dst); } catch (_) {}
        }
      }
    } catch (e) {
      console.error("[kanagawa-ide] repo mirror failed:", e);
    }
  }

  function markInternalWrite(ms = 900) {
    suppressWatchUntil = Math.max(suppressWatchUntil, Date.now() + ms);
  }

  function readCurrentThemeConfig(themeDir, builder) {
    const configPath = path.join(themeDir, "kanagawa.config.json");
    let raw = {};
    if (fs.existsSync(configPath)) {
      try { raw = JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch (_) {}
    }
    return builder.mergeConfig(raw);
  }

  function makeStudioThumb(themeDir, builder, id) {
    try {
      const filename = String(id || "").replace(/^library:/, "").replace(/[\\/]/g, "");
      if (!filename) return "";
      const fullPath = path.join(themeDir, "assets", "library", filename);
      if (!fs.existsSync(fullPath)) return "";
      try {
        const img = nativeImage.createFromPath(fullPath);
        if (img && !img.isEmpty()) {
          return img.resize({ width: 160, quality: "good" }).toDataURL();
        }
      } catch (_) {}
      const ext = path.extname(fullPath).toLowerCase();
      const mime = (builder && builder.MIME_MAP && builder.MIME_MAP[ext]) || "";
      if (!mime) return "";
      const st = fs.statSync(fullPath);
      if (st.size > 6 * 1024 * 1024) return "";
      return "data:" + mime + ";base64," + fs.readFileSync(fullPath).toString("base64");
    } catch (_) {
      return "";
    }
  }

  function buildStudioState(themeDir, builder, extraThumbs) {
    builder.ensureCustomCssFile(themeDir);
    if (builder.listLibraryAssets(themeDir).length === 0) {
      const cssPath = path.join(themeDir, "kanagawa.css");
      if (fs.existsSync(cssPath)) {
        try { builder.seedLibraryFromCss(themeDir, fs.readFileSync(cssPath, "utf-8")); } catch (_) {}
      }
    }
    const config = readCurrentThemeConfig(themeDir, builder);
    builder.ensureDefaultProfiles(themeDir, config);
    const profiles = builder.listProfiles(themeDir);
    const library = builder.listLibraryAssets(themeDir);
    const customCss = builder.readCustomCss(themeDir, true);
    const out = { config, profiles, library, customCss };
    if (extraThumbs) out.thumbs = extraThumbs;
    return out;
  }

  function assignImageTarget(cfg, target, libRef) {
    if (target === "wallpaper") cfg.wallpaper = libRef;
    else if (target === "wallpaperLight") cfg.wallpaperLight = libRef;
    else if (target === "userAvatar") {
      cfg.userAvatar = libRef;
      cfg.avatars.userVisible = true;
    } else if (target === "agentAvatar") {
      cfg.agentAvatar.image = libRef;
      cfg.avatars.agentVisible = true;
    }
  }

  async function broadcastThemeCssRefresh() {
    cssReadCache.path = null;
    const css = readThemeCss();
    if (!css) return;
    const tasks = [];
    for (const entry of activeIdeWindows.values()) {
      if (!entry || entry.win.isDestroyed() || entry.wc.isDestroyed()) continue;
      tasks.push(Promise.resolve(entry.applyCss(css)).catch(() => {}));
    }
    if (tasks.length > 0) await Promise.all(tasks);
  }

  function broadcastStudioReinject() {
    const themeDir = getThemeDir();
    const code = loadStudioScript(themeDir);
    if (!code) return;
    for (const entry of activeIdeWindows.values()) {
      if (!entry || entry.win.isDestroyed() || entry.wc.isDestroyed()) continue;
      if (!isWorkbenchUrl(entry.wc.getURL())) continue;
      entry.wc
        .executeJavaScript("window.__knStudio && window.__knStudio.stop && window.__knStudio.stop();", true)
        .catch(() => {})
        .then(() => entry.wc.executeJavaScript(code, true))
        .catch(() => {});
    }
  }

  function broadcastStudioState(sourceWc, data, external = false) {
    const payloadJson = JSON.stringify({ event: "state-updated", external: Boolean(external), data })
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
    const script = "window.__knStudioReceive && window.__knStudioReceive(" + payloadJson + ")";
    for (const entry of activeIdeWindows.values()) {
      if (!entry || (sourceWc && entry.wc === sourceWc) || entry.win.isDestroyed() || entry.wc.isDestroyed()) continue;
      if (!isWorkbenchUrl(entry.wc.getURL())) continue;
      entry.wc.executeJavaScript(script, true).catch(() => {});
    }
  }

  function ensureThemeDirWatch(themeDir) {
    if (!themeDir || !fs.existsSync(themeDir)) return;
    if (watchedThemeDir === themeDir && themeDirWatcher) return;
    if (themeDirWatcher) {
      try { themeDirWatcher.close(); } catch (_) {}
      themeDirWatcher = null;
    }
    watchedThemeDir = themeDir;
    try {
      let studioChanged = false;
      let cssChanged = false;
      let stateChanged = false;
      const onWatchEvent = (_eventType, filename) => {
        if (Date.now() < suppressWatchUntil) return;
        const norm = String(filename || "").replace(/\\/g, "/").toLowerCase();
        if (!norm) return;
        const base = path.posix.basename(norm);
        if (!base || base === ".live-watch.json" || base === "repo-link.json" || base.endsWith(".tmp") || base.endsWith(".bak")) return;
        if (norm === "studio.js") studioChanged = true;
        else if (norm === "custom.css") { cssChanged = true; stateChanged = true; }
        else if (norm.endsWith(".css")) cssChanged = true;
        else if (norm === "kanagawa.config.json" || norm.startsWith("profiles/") || norm.startsWith("assets/library/")) stateChanged = true;
        else return;
        clearTimeout(themeReloadDebounce);
        themeReloadDebounce = setTimeout(async () => {
          if (Date.now() < suppressWatchUntil) {
            cssChanged = false; studioChanged = false; stateChanged = false;
            return;
          }
          const needCss = cssChanged;
          const needStudio = studioChanged;
          const needState = stateChanged;
          cssChanged = false; studioChanged = false; stateChanged = false;
          if (needCss) await broadcastThemeCssRefresh();
          if (needStudio) broadcastStudioReinject();
          if (needState) {
            try {
              const builder = getThemeBuilder(themeDir);
              if (builder) {
                const stateData = buildStudioState(themeDir, builder);
                broadcastStudioState(null, stateData, true);
              }
            } catch (err) {
              console.error("[kanagawa-ide] watch state sync failed:", err);
            }
          }
        }, 200);
      };
      try {
        themeDirWatcher = fs.watch(themeDir, { persistent: false, recursive: true }, onWatchEvent);
      } catch (_) {
        themeDirWatcher = fs.watch(themeDir, { persistent: false }, onWatchEvent);
      }
    } catch (e) {
      console.error("[kanagawa-ide] theme dir watch failed:", e);
    }
  }

  function extractConsoleMessageText(args) {
    if (args.length === 1 && args[0] && typeof args[0] === "object" && typeof args[0].message === "string") {
      return args[0].message;
    }
    if (typeof args[2] === "string") return args[2];
    return "";
  }

  function isWorkbenchUrl(url) {
    return /^vscode-file:\/\/.*workbench\.html/i.test(String(url || ""));
  }

  async function handleStudioMessage(win, wc, rawMsg) {
    let parsed;
    try {
      parsed = JSON.parse(rawMsg.slice("__KN_STUDIO__".length));
    } catch (_) {
      return;
    }
    const { id, action } = parsed;
    const reply = (ok, dataOrErr) => {
      if (wc.isDestroyed()) return;
      const body = ok ? { id, ok: true, data: dataOrErr } : { id, ok: false, error: String(dataOrErr || "Error") };
      const serialized = JSON.stringify(body).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
      wc.executeJavaScript("window.__knStudioReceive && window.__knStudioReceive(" + serialized + ")", true).catch(() => {});
    };

    try {
      const themeDir = getThemeDir();
      const builder = getThemeBuilder(themeDir);
      if (!builder) {
        reply(false, "theme-builder.js not found in " + themeDir);
        return;
      }

      if (action === "get-state") {
        reply(true, buildStudioState(themeDir, builder));
        return;
      }

      if (action === "get-library-thumbs") {
        const ids = Array.isArray(parsed.ids) ? parsed.ids.slice(0, 80) : [];
        const thumbs = {};
        for (const itemId of ids) {
          const url = makeStudioThumb(themeDir, builder, itemId);
          if (url) thumbs[itemId] = url;
        }
        reply(true, { thumbs });
        return;
      }

      if (action === "apply-config") {
        markInternalWrite();
        const res = builder.applyThemeConfig(themeDir, parsed.config || readCurrentThemeConfig(themeDir, builder));
        await broadcastThemeCssRefresh();
        mirrorToRepo(themeDir, ["kanagawa.config.json", "kanagawa.css", "loading.html", "custom.css"]);
        markInternalWrite();
        const stateData = {
          config: res.cfg,
          profiles: builder.listProfiles(themeDir),
          library: builder.listLibraryAssets(themeDir),
          customCss: builder.readCustomCss(themeDir, true),
        };
        reply(true, stateData);
        broadcastStudioState(wc, stateData, false);
        return;
      }

      if (action === "apply-preset-colors") {
        markInternalWrite();
        const baseCfg = parsed.config || readCurrentThemeConfig(themeDir, builder);
        const nextCfg = builder.applyPresetToConfig(baseCfg, parsed.presetId);
        const res = builder.applyThemeConfig(themeDir, nextCfg);
        await broadcastThemeCssRefresh();
        mirrorToRepo(themeDir, ["kanagawa.config.json", "kanagawa.css", "loading.html", "custom.css"]);
        markInternalWrite();
        const stateData = {
          config: res.cfg,
          profiles: builder.listProfiles(themeDir),
          library: builder.listLibraryAssets(themeDir),
          customCss: builder.readCustomCss(themeDir, true),
        };
        reply(true, stateData);
        broadcastStudioState(wc, stateData, false);
        return;
      }

      if (action === "pick-image") {
        const target = String(parsed.target || "wallpaper");
        const parentWin = win && !win.isDestroyed() ? win : undefined;
        const picked = await dialog.showOpenDialog(parentWin, {
          title: "Chọn ảnh cho Kanagawa Studio",
          properties: ["openFile"],
          filters: [
            { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "avif", "gif", "svg", "bmp"] },
            { name: "All files", extensions: ["*"] },
          ],
        });
        if (picked.canceled || !picked.filePaths || !picked.filePaths[0]) {
          reply(true, { canceled: true });
          return;
        }
        const prefix = target === "wallpaperLight" ? "wp-light" : target === "userAvatar" ? "user" : target === "agentAvatar" ? "agent" : "wp";
        markInternalWrite();
        const libRef = builder.importAssetToLibrary(themeDir, picked.filePaths[0], prefix);
        const baseCfg = (parsed.config && typeof parsed.config === "object" && !Array.isArray(parsed.config))
          ? builder.mergeConfig(parsed.config)
          : readCurrentThemeConfig(themeDir, builder);
        assignImageTarget(baseCfg, target, libRef);
        const res = builder.applyThemeConfig(themeDir, baseCfg);
        await broadcastThemeCssRefresh();
        const libFile = libRef.replace(/^library:/, "");
        mirrorToRepo(themeDir, [
          "kanagawa.config.json",
          "kanagawa.css",
          "loading.html",
          "custom.css",
          path.join("assets", "library", libFile),
        ]);
        markInternalWrite();
        const thumb = makeStudioThumb(themeDir, builder, libRef);
        const stateData = {
          canceled: false,
          config: res.cfg,
          profiles: builder.listProfiles(themeDir),
          library: builder.listLibraryAssets(themeDir),
          customCss: builder.readCustomCss(themeDir, true),
          thumbs: thumb ? { [libRef]: thumb } : {},
        };
        reply(true, stateData);
        broadcastStudioState(wc, stateData, false);
        return;
      }

      if (action === "upload-chunk") {
        const { uploadId, filename, target, index, total, data } = parsed;
        if (
          typeof uploadId !== "string" || !uploadId || uploadId.length > 128 ||
          typeof data !== "string" ||
          !Number.isInteger(total) || total < 1 || total > MAX_UPLOAD_CHUNKS ||
          !Number.isInteger(index) || index < 0 || index >= total ||
          data.length > MAX_UPLOAD_DATAURL_CHARS
        ) {
          reply(false, "Invalid upload chunk payload");
          return;
        }
        let entry = studioUploadChunks.get(uploadId);
        if (!entry) {
          entry = {
            wcId: wc.id,
            filename: String(filename || "drop.png"),
            target: String(target || "wallpaper"),
            total,
            chunks: new Array(total),
            chunkSizes: new Array(total).fill(0),
            totalChars: 0,
            received: 0,
            baseConfig: (parsed.config && typeof parsed.config === "object" && !Array.isArray(parsed.config)) ? parsed.config : null,
            timer: null,
          };
          studioUploadChunks.set(uploadId, entry);
        } else if (entry.total !== total || entry.wcId !== wc.id) {
          reply(false, "Mismatched upload chunk session");
          return;
        } else if (parsed.config && typeof parsed.config === "object" && !Array.isArray(parsed.config)) {
          entry.baseConfig = parsed.config;
        }
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = setTimeout(() => studioUploadChunks.delete(uploadId), 60000);
        const nextTotalChars = entry.totalChars - entry.chunkSizes[index] + data.length;
        if (nextTotalChars > MAX_UPLOAD_DATAURL_CHARS) {
          clearTimeout(entry.timer);
          studioUploadChunks.delete(uploadId);
          reply(false, "Upload exceeds 15 MB limit");
          return;
        }
        if (entry.chunks[index] === undefined) entry.received++;
        entry.totalChars = nextTotalChars;
        entry.chunkSizes[index] = data.length;
        entry.chunks[index] = data;
        if (entry.received < entry.total) {
          reply(true, { complete: false, received: entry.received, total: entry.total });
          return;
        }
        clearTimeout(entry.timer);
        studioUploadChunks.delete(uploadId);
        const fullDataUrl = entry.chunks.join("");
        if (!/^data:image\//i.test(fullDataUrl)) {
          reply(false, "Only image data URLs are supported");
          return;
        }
        markInternalWrite();
        const libRef = builder.saveDataUrlToLibrary(themeDir, fullDataUrl, entry.filename);
        const baseCfg = entry.baseConfig
          ? builder.mergeConfig(entry.baseConfig)
          : readCurrentThemeConfig(themeDir, builder);
        assignImageTarget(baseCfg, entry.target, libRef);
        const res = builder.applyThemeConfig(themeDir, baseCfg);
        await broadcastThemeCssRefresh();
        const libFile = libRef.replace(/^library:/, "");
        mirrorToRepo(themeDir, [
          "kanagawa.config.json",
          "kanagawa.css",
          "loading.html",
          "custom.css",
          path.join("assets", "library", libFile),
        ]);
        markInternalWrite();
        const thumb = makeStudioThumb(themeDir, builder, libRef);
        const stateData = {
          complete: true,
          config: res.cfg,
          profiles: builder.listProfiles(themeDir),
          library: builder.listLibraryAssets(themeDir),
          customCss: builder.readCustomCss(themeDir, true),
          thumbs: thumb ? { [libRef]: thumb } : {},
        };
        reply(true, stateData);
        broadcastStudioState(wc, stateData, false);
        return;
      }

      if (action === "delete-library-asset") {
        const assetId = String(parsed.assetId || "");
        const filename = assetId.replace(/^library:/, "").replace(/[\\/]/g, "");
        markInternalWrite();
        builder.deleteLibraryAsset(themeDir, assetId);
        const cfg = (parsed.config && typeof parsed.config === "object" && !Array.isArray(parsed.config))
          ? builder.mergeConfig(parsed.config)
          : readCurrentThemeConfig(themeDir, builder);
        let cfgChanged = false;
        if (cfg.wallpaper === assetId) { cfg.wallpaper = "NONE"; cfgChanged = true; }
        if (cfg.wallpaperLight === assetId) { cfg.wallpaperLight = "SAME"; cfgChanged = true; }
        if (cfg.userAvatar === assetId) {
          cfg.userAvatar = "NONE";
          if (cfg.avatars) cfg.avatars.userVisible = false;
          cfgChanged = true;
        }
        if (cfg.agentAvatar && cfg.agentAvatar.image === assetId) {
          cfg.agentAvatar.image = "NONE";
          if (cfg.avatars) cfg.avatars.agentVisible = false;
          cfgChanged = true;
        }
        let appliedCfg = cfg;
        if (cfgChanged) {
          const res = builder.applyThemeConfig(themeDir, cfg);
          appliedCfg = res.cfg;
          await broadcastThemeCssRefresh();
        }
        mirrorToRepo(
          themeDir,
          cfgChanged ? ["kanagawa.config.json", "kanagawa.css", "loading.html", "custom.css"] : [],
          filename ? [path.join("assets", "library", filename)] : []
        );
        markInternalWrite();
        const stateData = {
          config: appliedCfg,
          library: builder.listLibraryAssets(themeDir),
          profiles: builder.listProfiles(themeDir),
          customCss: builder.readCustomCss(themeDir, true),
        };
        reply(true, stateData);
        broadcastStudioState(wc, stateData, false);
        return;
      }

      if (action === "load-profile") {
        markInternalWrite();
        const baseCfg = (parsed.config && typeof parsed.config === "object" && !Array.isArray(parsed.config))
          ? builder.mergeConfig(parsed.config)
          : readCurrentThemeConfig(themeDir, builder);
        const loaded = builder.loadProfile(themeDir, parsed.profileId, baseCfg);
        const res = builder.applyThemeConfig(themeDir, loaded.config);
        await broadcastThemeCssRefresh();
        mirrorToRepo(themeDir, ["kanagawa.config.json", "kanagawa.css", "loading.html", "custom.css"]);
        markInternalWrite();
        const stateData = {
          config: res.cfg,
          profiles: builder.listProfiles(themeDir),
          library: builder.listLibraryAssets(themeDir),
          customCss: builder.readCustomCss(themeDir, true),
        };
        reply(true, stateData);
        broadcastStudioState(wc, stateData, false);
        return;
      }

      if (action === "save-profile") {
        markInternalWrite();
        const baseCfg = builder.mergeConfig(parsed.config || readCurrentThemeConfig(themeDir, builder));
        const saveOpts = {
          id: parsed.profileId,
          description: parsed.description,
          builtIn: parsed.builtIn,
        };
        if (parsed.preserveWallpaper !== undefined) saveOpts.preserveWallpaper = Boolean(parsed.preserveWallpaper);
        if (parsed.preserveAvatars !== undefined) saveOpts.preserveAvatars = Boolean(parsed.preserveAvatars);
        const saved = builder.saveProfile(themeDir, parsed.name || parsed.profileId, baseCfg, saveOpts);
        const res = builder.applyThemeConfig(themeDir, saved.config);
        await broadcastThemeCssRefresh();
        mirrorToRepo(themeDir, [
          "kanagawa.config.json",
          "kanagawa.css",
          "loading.html",
          "custom.css",
          path.join("profiles", saved.id + ".json"),
        ]);
        markInternalWrite();
        const stateData = {
          config: res.cfg,
          profiles: builder.listProfiles(themeDir),
          library: builder.listLibraryAssets(themeDir),
          customCss: builder.readCustomCss(themeDir, true),
        };
        reply(true, stateData);
        broadcastStudioState(wc, stateData, false);
        return;
      }

      if (action === "delete-profile") {
        const deletedId = String(parsed.profileId || "");
        const safeId = deletedId.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
        markInternalWrite();
        builder.deleteProfile(themeDir, deletedId);
        const cfg = readCurrentThemeConfig(themeDir, builder);
        let cfgChanged = false;
        if (cfg.activeProfile === safeId || cfg.activeProfile === deletedId) {
          cfg.activeProfile = "";
          cfgChanged = true;
          fs.writeFileSync(path.join(themeDir, "kanagawa.config.json"), JSON.stringify(cfg, null, 2) + "\n", "utf-8");
        }
        mirrorToRepo(
          themeDir,
          cfgChanged ? ["kanagawa.config.json"] : [],
          safeId ? [path.join("profiles", safeId + ".json")] : []
        );
        markInternalWrite();
        const stateData = {
          config: cfg,
          profiles: builder.listProfiles(themeDir),
        };
        reply(true, stateData);
        broadcastStudioState(wc, stateData, false);
        return;
      }

      if (action === "save-custom-css") {
        markInternalWrite();
        const customText = String(parsed.customCss || "");
        const cfg = readCurrentThemeConfig(themeDir, builder);
        const res = builder.applyThemeConfig(themeDir, cfg, { customCss: customText });
        await broadcastThemeCssRefresh();
        mirrorToRepo(themeDir, ["custom.css", "kanagawa.css", "kanagawa.config.json"]);
        markInternalWrite();
        const stateData = {
          config: res.cfg,
          customCss: customText,
        };
        reply(true, stateData);
        broadcastStudioState(wc, stateData, false);
        return;
      }

      if (action === "reset-default") {
        markInternalWrite();
        const defCfg = builder.defaultConfig();
        const res = builder.applyThemeConfig(themeDir, defCfg, { customCss: "" });
        await broadcastThemeCssRefresh();
        mirrorToRepo(themeDir, ["kanagawa.config.json", "kanagawa.css", "loading.html", "custom.css"]);
        markInternalWrite();
        const stateData = {
          config: res.cfg,
          profiles: builder.listProfiles(themeDir),
          library: builder.listLibraryAssets(themeDir),
          customCss: "",
        };
        reply(true, stateData);
        broadcastStudioState(wc, stateData, false);
        return;
      }

      if (action === "reload-window") {
        reply(true, { reloading: true });
        setTimeout(() => {
          if (!wc.isDestroyed()) wc.reload();
        }, 80);
        return;
      }

      if (action === "open-folder") {
        const targetDir = readRepoLink(themeDir) || themeDir;
        await shell.openPath(targetDir);
        reply(true, { path: targetDir });
        return;
      }

      reply(false, "Unknown studio action: " + action);
    } catch (e) {
      console.error("[kanagawa-ide] handler error:", e);
      reply(false, e && e.message ? e.message : String(e));
    }
  }

  app.on("browser-window-created", (_ev, win) => {
    try {
      const wc = win.webContents;
      const wcId = wc.id;
      let lastCssKey = null;
      let cssChain = Promise.resolve();

      const applyCss = (css) => {
        cssChain = cssChain
          .then(async () => {
            if (wc.isDestroyed()) return;
            const prevKey = lastCssKey;
            const nextKey = await wc.insertCSS(css);
            lastCssKey = nextKey;
            if (prevKey) {
              try { await wc.removeInsertedCSS(prevKey); } catch (_) {}
            }
          })
          .catch((e) => console.error("[kanagawa-ide] insertCSS failed:", e));
        return cssChain;
      };

      activeIdeWindows.set(wcId, { win, wc, applyCss });
      ensureThemeDirWatch(getThemeDir());

      wc.on("dom-ready", () => {
        if (!isWorkbenchUrl(wc.getURL())) return;
        const css = readThemeCss();
        if (css) applyCss(css);
        const studioCode = loadStudioScript(getThemeDir());
        if (studioCode) {
          wc.executeJavaScript(studioCode, true).catch((e) => console.error("[kanagawa-ide] studio inject failed:", e));
        }
      });

      wc.on("console-message", (...args) => {
        const msg = extractConsoleMessageText(args);
        if (msg && msg.startsWith("__KN_STUDIO__")) {
          void handleStudioMessage(win, wc, msg);
        }
      });

      win.on("closed", () => {
        activeIdeWindows.delete(wcId);
        for (const [upId, entry] of studioUploadChunks.entries()) {
          if (entry && entry.wcId === wcId) {
            if (entry.timer) clearTimeout(entry.timer);
            studioUploadChunks.delete(upId);
          }
        }
        if (activeIdeWindows.size === 0) {
          if (themeReloadDebounce) {
            clearTimeout(themeReloadDebounce);
            themeReloadDebounce = null;
          }
          if (themeDirWatcher) {
            try { themeDirWatcher.close(); } catch (_) {}
            themeDirWatcher = null;
            watchedThemeDir = null;
          }
        }
      });
    } catch (e) {
      console.error("[kanagawa-ide] attach failed:", e);
    }
  });
}

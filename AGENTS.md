# AGENTS.md — AI Agent Guide for Antigravity Kanagawa Theme

[🇻🇳 Tiếng Việt](#tiếng-việt) | [🇺🇸 English](#english)

This file instructs AI coding assistants (Antigravity, Claude Code, Codex, Cursor, Gemini CLI, etc.) on how to safely **install**, **customize**, **hot-reload**, **modify**, and **troubleshoot** this repository without breaking Google Antigravity 2.x.

---

<a name="tiếng-việt"></a>
## 🇻🇳 Tiếng Việt — Hướng dẫn dành cho AI

### 1. Kiến trúc & Vai trò từng file

- `install.ps1` / `install.bat`: Giải nén `%LOCALAPPDATA%\Programs\Antigravity\resources\app.asar`, backup thành `app.asar.pixel-backup`, patch `dist/utils.js` & `dist/ipcHandlers.js`, chèn `patch/pixelTheme.js`, đóng gói lại `app.asar`, copy `kanagawa-theme/` sang `resources\kanagawa-theme\` và ghi `resources\active-theme.json`. Trừ khi truyền `-SkipIde`, script cũng tự động liên kết `%LOCALAPPDATA%\Programs\Antigravity IDE\resources\app\out\` (backup `main.js` → `main.js.pixel-backup`, chèn marker `KANAGAWA-IDE-HOOK-START/END` và copy `patch/ideTheme.mjs` → `kanagawa-ide-hook.mjs`).
- `patch/pixelTheme.js`: Injector chạy trong `app.asar` (Agent Manager), nạp CSS + `studio.js` (nếu có), mở `fs.watch` live hot-swap CSS không cần reload toàn trang, xử lý bridge `__KN_STUDIO__` (tương thích Electron 44 `console-message` event object) và đồng bộ ngược về repo qua `repo-link.json`.
- `patch/ideTheme.mjs`: Hook ESM chạy trong **Antigravity IDE** (`%LOCALAPPDATA%\Programs\Antigravity IDE\resources\app\out\kanagawa-ide-hook.mjs`), liên kết trực tiếp các cửa sổ workbench (`workbench*.html`, bao gồm `workbench-jetski-agent*.html`) tới `%LOCALAPPDATA%\Programs\antigravity\resources\kanagawa-theme\` để dùng chung CSS, `studio.js` (`Ctrl+Alt+K`), config, thư viện ảnh & đồng bộ live 2 chiều qua `fs.watch` và `repo-link.json`.
- `kanagawa-theme/theme-builder.js`: Core compiler (Node thuần, 0 dependency) quản lý config schema v2, biên dịch block `:root` `--kn-*`/`--kw-*`/`--kl-*`/`--px-chrome-*` (`KANAGAWA-CUSTOM-SURFACE`), `KANAGAWA-EMBEDDED-ASSETS`, `KANAGAWA-USER-CUSTOM-CSS`, `loading.html` (CSP + 3 style: `kanagawa-wave`/`minimal`/`terminal`), thư viện ảnh `assets/library/` (hỗ trợ `.avif`) và `profiles/*.json` (hồ sơ built-in tạo mới bởi `ensureDefaultProfiles` đặt `preserveWallpaper`/`preserveAvatars` để không ghi đè ảnh hiện tại của người dùng, riêng `minimal-clean` đặt `wallpaper: "NONE"`, trong khi các hồ sơ đã được tùy biến sẵn trong repo giữ nguyên cấu hình/ảnh của chúng).
- `kanagawa-theme/studio.js`: Giao diện In-App Theme Studio (Shadow DOM cô lập, zero-`innerHTML` tương thích TrustedTypes của IDE, song ngữ `🌐 VI / EN`, phím tắt `Ctrl+Alt+K`), hoạt động trên cả Agent Manager lẫn Antigravity IDE (theo dõi cả `document.body` lẫn `.monaco-workbench`) với live preview 60fps.
- `kanagawa-theme/kanagawa.config.json`: Nguồn cấu hình trung tâm v2 (`activeProfile`, `preset`, `dark`/`light`, `wallpaper`, `wallpaperLight`, `wallpaperFit`, `wallpaperEffects`, `surfaces`, `avatars`, `typography`, `composer`, `userAvatar`, `agentAvatar`, `loading`, `studio`).
- `kanagawa-theme/custom.css`: CSS tùy biến riêng của người dùng, tự động giữ lại qua mọi lần biên dịch theme.
- `kanagawa-theme/kanagawa.css`: Stylesheet hoàn chỉnh của theme cho cả Agent Manager lẫn `.monaco-workbench` IDE (chứa 3 block tự động quản lý ở cuối file: `KANAGAWA-CUSTOM-SURFACE`, `KANAGAWA-EMBEDDED-ASSETS`, `KANAGAWA-USER-CUSTOM-CSS`).
- `kanagawa-theme/loading.html`: Màn hình loading khi mở Antigravity (được sinh tự động từ `kanagawa.config.json` với style `kanagawa-wave` / `minimal` / `terminal` và CSP).
- `scripts/apply_kanagawa_config.js`: CLI wrapper gọi `kanagawa-theme/theme-builder.js` (`--help`, `--seed-only`, `--dry-run`, `--list-presets`, `--list-profiles`, `--profile`, `--preset`, `--wallpaper`, `--scrim-style`, `--loading-style terminal`, `--user-avatar-*`/`--agent-avatar-*`, `--wp-blur`, `--glass-blur`, `--panel-opacity`, `--studio-lang`, `--save-profile`, hỗ trợ `--flag=value`).
- `customize-kanagawa.ps1` / `customize-kanagawa.bat`: Wrapper PowerShell (menu + picker `.avif` + đầy đủ cờ CLI màu/avatar/scrim/typography/loading/studio) gọi `apply_kanagawa_config.js` rồi chạy `switch-theme.ps1`.
- `switch-theme.ps1` / `switch-theme.bat`: Copy `kanagawa-theme/*` sang `resources\kanagawa-theme\` (có cắt tỉa file thừa trong `profiles/` & `assets/library/`), ghi `repo-link.json`, và đồng bộ `patch/ideTheme.mjs` sang `Antigravity IDE\resources\app\out\kanagawa-ide-hook.mjs` nếu IDE đã được gắn hook; nếu tiến trình Antigravity hoặc Antigravity IDE đang bật live-watch thì để `fs.watch` hot-swap CSS không cần reload (ngược lại hoặc truyền `-ForceReload` mới gửi CDP `Page.reload`).
- `uninstall.ps1` / `uninstall.bat`: Khôi phục `app.asar.pixel-backup` (nếu thiếu backup vẫn tự reverse-unpatch sạch 6 anchor `dist/utils.js` + `dist/ipcHandlers.js` và xóa `dist/pixelTheme.js`), khôi phục `Antigravity IDE\resources\app\out\main.js` (từ `main.js.pixel-backup` hoặc gỡ marker `KANAGAWA-IDE-HOOK-START/END`) + xóa `kanagawa-ide-hook.mjs`, rồi xóa `resources\kanagawa-theme\` + `active-theme.json`.

### 2. Quy tắc an toàn bắt buộc cho AI

1. **KHÔNG tự chạy `.\install.ps1 -KillRunning` hoặc `.\uninstall.ps1 -KillRunning` từ terminal bên trong Antigravity hoặc Antigravity IDE:** Lệnh `-KillRunning` sẽ buộc đóng các tiến trình `Antigravity`, `Antigravity IDE` (trừ khi dùng `install.ps1 -SkipIde`) và `language_server` (giết luôn phiên làm việc của chính bạn). Nếu cần cài mới / gỡ cài đặt / cập nhật `patch\pixelTheme.js` hoặc gắn hook IDE lần đầu, hãy yêu cầu người dùng đóng app hoặc tự chạy lệnh từ cửa sổ PowerShell bên ngoài.
2. **Tùy biến giao diện KHÔNG cần đóng Antigravity hay repack `app.asar`:** Sau khi đã cài 1 lần, mọi thao tác đổi hình nền, màu, preset, avatar hoặc sửa CSS đều dùng `.\customize-kanagawa.ps1` hoặc `.\switch-theme.ps1` (hot-reload an toàn ngay trong phiên AI).
3. **KHÔNG lưu ảnh lớn (hình nền > ~2 MB) vào CSS Custom Property (`--kn-*`):** Chromium cắt cụt CSS variable lớn hơn ~2 MB khiến hình nền bị đen thui. Luôn dùng `scripts/apply_kanagawa_config.js` để xuất rule trực tiếp (`html::before`, avatar `::before`) trong block `KANAGAWA-EMBEDDED-ASSETS`.
4. **Không sửa tay vào trong 2 block được quản lý tự động** ở cuối `kanagawa-theme/kanagawa.css`:
   - `/* === KANAGAWA-CUSTOM-SURFACE-START === */` ... `END`
   - `/* === KANAGAWA-EMBEDDED-ASSETS-START === */` ... `END`
   Nếu cần sửa CSS layout/component cố định, hãy sửa phía **trước** các block này.
5. **PowerShell 5.1 & Encoding:** Khi nối nhiều lệnh trên Windows PowerShell 5.1, dùng `;` (không dùng `&&`). Nếu chỉnh sửa file `.ps1`, giữ nguyên **UTF-8 BOM**.
6. **Kiểm tra trước khi ghi file thật:** Khi test thay đổi logic script/config, ưu tiên chạy `node scripts/apply_kanagawa_config.js --dry-run` (và cờ thử nghiệm tương ứng) để xác nhận `braces` cân bằng và không ghi đè ngoài ý muốn theme hiện tại của người dùng.

### 3. Quy trình AI thực hiện cài đặt & tùy biến

#### A. Hướng dẫn người dùng cài đặt lần đầu (hoặc sau khi Antigravity / Antigravity IDE tự update)
- Yêu cầu môi trường: Windows, Google Antigravity 2.x tại `%LOCALAPPDATA%\Programs\Antigravity` (và tùy chọn Antigravity IDE tại `%LOCALAPPDATA%\Programs\Antigravity IDE`), Node.js (để chạy `npx @electron/asar` và scripts).
- Nếu chưa cài, hướng dẫn người dùng chạy trong **PowerShell bên ngoài** tại thư mục repo:
  ```powershell
  .\install.ps1 -KillRunning
  ```
  *(Truyền thêm `-SkipIde` nếu chỉ muốn cài cho Antigravity chính và bỏ qua Antigravity IDE.)*
- Sau đó mở lại Antigravity (và Antigravity IDE nếu dùng).

#### B. Tùy biến nhanh theo yêu cầu người dùng (chạy trực tiếp bằng shell)
- **Xem danh sách preset:**
  ```powershell
  node scripts/apply_kanagawa_config.js --list-presets
  ```
  *(Preset có sẵn: `kanagawa-wave`, `kanagawa-dragon`, `sakura-dusk`, `midnight-aqua`, `tokyo-night`, `nordic-frost`)*
- **Đổi preset màu:**
  ```powershell
  .\customize-kanagawa.ps1 -Preset sakura-dusk
  ```
- **Đổi hình nền, vị trí canh ảnh, scrim & hiệu ứng:**
  ```powershell
  .\customize-kanagawa.ps1 -Wallpaper "C:\path\to\wallpaper.jpg" -WallpaperPosition "right top" -ScrimStyle gradient -WpBlur 6
  ```
- **Tắt hình nền (dùng nền màu trơn theo preset):**
  ```powershell
  .\customize-kanagawa.ps1 -NoWallpaper
  ```
  *(Hoặc truyền `-Wallpaper NONE`, hoặc đặt `"wallpaper": "NONE"` / `"off"` / `""` trong `kanagawa.config.json`.)*
- **Đổi 2 avatar & chỉnh kích thước/bo góc/xoay từng avatar:**
  ```powershell
  .\customize-kanagawa.ps1 -UserAvatar "C:\path\to\user.png" -AgentAvatar "C:\path\to\agent.png" -UserAvatarSize 40 -AgentAvatarRotate 0 -UserAvatarVisible "true"
  ```
  - Để khôi phục icon sao 4 cánh vector cho Agent Avatar: `-AgentAvatar SVG_STAR`.
- **Chỉnh riêng từng mã màu hex & màn hình loading / Studio qua CLI:**
  - Màu: `-DarkPrimary`, `-DarkBlue`, `-DarkAqua`, `-DarkSurface`, `-DarkChrome`, `-DarkSidebar`, `-DarkOverlay`, `-DarkScrim`, `-DarkSelection`, `-LightPrimary`, `-LightChrome`, `-LightSurface`
  - Loading & Studio: `-LoadingTitle`, `-LoadingSubtitle`, `-LoadingStyle kanagawa-wave|minimal|terminal`, `-LoadingShowEmblem "true|false"`, `-LoadingShowProgress "true|false"`, `-StudioPill "true|false"`, `-StudioPillPos`, `-StudioLang vi|en`
  - Dùng `.\customize-kanagawa.ps1 -Help` hoặc `node scripts/apply_kanagawa_config.js --help` để xem toàn bộ danh sách cờ.
- **Chỉ tạo/cập nhật file trong repo mà chưa reload Antigravity:** thêm `-NoReload`.
- **Chỉnh toàn bộ bảng màu / chữ màn hình loading:** Sửa trực tiếp `kanagawa-theme/kanagawa.config.json` (`dark.*`, `light.*`, `agentAvatar.bgStops`, `agentAvatar.iconStops`, `loading.title`, `loading.subtitle`), sau đó chạy:
  ```powershell
  .\customize-kanagawa.ps1
  ```

#### C. Lưu ý tính di động (Portability) của `kanagawa.config.json`
Khi truyền đường dẫn ảnh nằm ngoài thư mục `kanagawa-theme/`, `theme-builder.js` tự sao chép ảnh vào thư mục thư viện nội bộ `kanagawa-theme/assets/library/` và lưu tham chiếu tương đối portable `"library:<filename>"` vào `kanagawa.config.json` (đồng thời nhúng Data URL vào block `KANAGAWA-EMBEDDED-ASSETS` trong `kanagawa.css`), giúp config không bị dính đường dẫn cục bộ (`C:\Users\...`). Hồ sơ built-in đặt `preserveWallpaper`/`preserveAvatars` để đổi preset không ghi đè ảnh hiện tại của người dùng (trừ `minimal-clean` đặt `wallpaper: "NONE"`).

#### D. Xử lý lỗi thường gặp
- **Hình nền bị đen sau khi đổi ảnh:** Kiểm tra xem `kanagawa.css` có rule `html::before` trong block `KANAGAWA-EMBEDDED-ASSETS` hay vẫn còn biến `--kn-wallpaper` cũ; chạy lại `node scripts/apply_kanagawa_config.js --wallpaper "<đường-dẫn>"` rồi `.\switch-theme.ps1`.
- **Hot-reload không đổi giao diện:** Đảm bảo `%APPDATA%\Antigravity\DevToolsActivePort` tồn tại và `switch-theme.ps1` chỉ reload target có URL `^https?:`; nếu chưa có CDP port, bảo người dùng bấm `Ctrl+R` trong Antigravity.

---

<a name="english"></a>
## 🇺🇸 English — AI Agent Instructions

### 1. Repository Architecture

- `install.ps1` / `install.bat`: Extracts `%LOCALAPPDATA%\Programs\Antigravity\resources\app.asar`, creates `app.asar.pixel-backup`, patches `dist/utils.js` & `dist/ipcHandlers.js`, injects `patch/pixelTheme.js`, repacks `app.asar`, deploys `kanagawa-theme/` to `resources\kanagawa-theme\`, and writes `resources\active-theme.json`. Unless `-SkipIde` is passed, it also links `%LOCALAPPDATA%\Programs\Antigravity IDE\resources\app\out\` (backing up `main.js` → `main.js.pixel-backup`, injecting `KANAGAWA-IDE-HOOK-START/END`, and copying `patch/ideTheme.mjs` → `kanagawa-ide-hook.mjs`).
- `patch/pixelTheme.js`: Runtime loader inside `app.asar` (Agent Manager) that injects active theme CSS + `studio.js` (if present), runs `fs.watch` zero-reload CSS hot-swap, bridges `__KN_STUDIO__` (Electron 44 `console-message` event object compatible), and mirrors Studio edits back to the repo via `repo-link.json`.
- `patch/ideTheme.mjs`: ESM hook for **Antigravity IDE** (`%LOCALAPPDATA%\Programs\Antigravity IDE\resources\app\out\kanagawa-ide-hook.mjs`), attaching theme CSS & `studio.js` (`Ctrl+Alt+K`) to IDE workbench windows (`workbench*.html`, including `workbench-jetski-agent*.html`) directly from `%LOCALAPPDATA%\Programs\antigravity\resources\kanagawa-theme\` with live two-way `fs.watch` and `repo-link.json` sync.
- `kanagawa-theme/theme-builder.js`: Dependency-free Node compiler managing config schema v2, generating `:root` `--kn-*`/`--kw-*`/`--kl-*`/`--px-chrome-*` block (`KANAGAWA-CUSTOM-SURFACE`), `KANAGAWA-EMBEDDED-ASSETS`, `KANAGAWA-USER-CUSTOM-CSS`, `loading.html` (CSP + styles `kanagawa-wave`/`minimal`/`terminal`), `assets/library/` (including `.avif`), and `profiles/*.json` (newly generated built-in presets in `ensureDefaultProfiles` mark `preserveWallpaper`/`preserveAvatars` so switching preserves active user media, `minimal-clean` sets `wallpaper: "NONE"`, and pre-customized built-in profiles in `profiles/` keep their explicit saved config/assets).
- `kanagawa-theme/studio.js`: In-App Theme Studio (Shadow DOM isolated, zero-`innerHTML` TrustedTypes-safe for IDE, bilingual `🌐 VI / EN`, `Ctrl+Alt+K`), supporting both Agent Manager and Antigravity IDE (watching both `document.body` and `.monaco-workbench`) with 60fps live preview.
- `kanagawa-theme/kanagawa.config.json`: Source of truth v2 (`activeProfile`, `preset`, `dark`/`light`, `wallpaper`, `wallpaperLight`, `wallpaperFit`, `wallpaperEffects`, `surfaces`, `avatars`, `typography`, `composer`, `userAvatar`, `agentAvatar`, `loading`, `studio`).
- `kanagawa-theme/custom.css`: Persistent user CSS overrides preserved across all theme rebuilds.
- `kanagawa-theme/kanagawa.css`: Main theme stylesheet covering both Agent Manager and IDE `.monaco-workbench` (ends with managed blocks: `KANAGAWA-CUSTOM-SURFACE`, `KANAGAWA-EMBEDDED-ASSETS`, `KANAGAWA-USER-CUSTOM-CSS`).
- `kanagawa-theme/loading.html`: Startup loading overlay HTML generated from `kanagawa.config.json` (`kanagawa-wave` / `minimal` / `terminal`, CSP-hardened).
- `scripts/apply_kanagawa_config.js`: CLI wrapper over `kanagawa-theme/theme-builder.js` (`--help`, `--seed-only`, `--dry-run`, `--list-presets`, `--list-profiles`, `--profile`, `--preset`, `--wallpaper`, `--scrim-style`, `--loading-style terminal`, `--user-avatar-*`/`--agent-avatar-*`, `--wp-blur`, `--glass-blur`, `--panel-opacity`, `--studio-lang`, `--save-profile`, supporting `--flag=value`).
- `customize-kanagawa.ps1` / `customize-kanagawa.bat`: PowerShell wrapper (with `.avif` picker, menu, and full palette/avatar/scrim/typography/loading/studio flags) invoking `apply_kanagawa_config.js` followed by `switch-theme.ps1`.
- `switch-theme.ps1` / `switch-theme.bat`: Syncs `kanagawa-theme/*` to `resources\kanagawa-theme\` (pruning stale files in `profiles/` & `assets/library/`), writes `repo-link.json`, and updates `kanagawa-ide-hook.mjs` from `patch/ideTheme.mjs` if Antigravity IDE is hooked; relies on zero-reload `fs.watch` when Agent Manager or Antigravity IDE live-watch is active (falling back to CDP `Page.reload` otherwise or with `-ForceReload`).
- `uninstall.ps1` / `uninstall.bat`: Restores `app.asar.pixel-backup` (with safe reverse-unpatch fallback reversing the 6 `dist/utils.js` anchors + `dist/ipcHandlers.js` and removing `dist/pixelTheme.js`), restores `Antigravity IDE\resources\app\out\main.js` (from `main.js.pixel-backup` or stripping `KANAGAWA-IDE-HOOK-START/END`) + deletes `kanagawa-ide-hook.mjs`, and removes deployed theme files + `active-theme.json`.

### 2. Mandatory Safety Rules for AI Agents

1. **NEVER run `.\install.ps1 -KillRunning` or `.\uninstall.ps1 -KillRunning` from an integrated terminal inside Antigravity or Antigravity IDE:** It forcefully terminates `Antigravity`, `Antigravity IDE` (unless `install.ps1 -SkipIde` is used), and `language_server` (killing your own active session). Instruct the user to run those from an **external PowerShell** window when installing, uninstalling, patching IDE `out/main.js`, or updating `patch\pixelTheme.js`.
2. **Customization never requires repacking `app.asar`:** Once installed, always use `.\customize-kanagawa.ps1` or `.\switch-theme.ps1` for safe live updates.
3. **NEVER store large wallpapers (> ~2 MB) inside CSS custom properties (`--kn-*`):** Chromium truncates oversized CSS variables, resulting in a black background. Always let `scripts/apply_kanagawa_config.js` emit direct rules (`html::before`, avatar `::before`) inside `KANAGAWA-EMBEDDED-ASSETS`.
4. **Do not manually edit inside managed blocks** at the bottom of `kanagawa-theme/kanagawa.css` (`KANAGAWA-CUSTOM-SURFACE-START/END` and `KANAGAWA-EMBEDDED-ASSETS-START/END`); put permanent layout/component CSS edits before them.
5. **PowerShell 5.1 & UTF-8 BOM:** Use `;` instead of `&&` in Windows PowerShell 5.1 commands, and preserve **UTF-8 BOM** when editing any `.ps1` file.
6. **Dry-run before mutating live config when testing:** Use `node scripts/apply_kanagawa_config.js --dry-run` to verify CSS byte size and balanced braces without overwriting user files.

### 3. Standard AI Runbooks

#### A. Initial Installation / After Antigravity or Antigravity IDE Auto-Update
- Prerequisites: Windows, Google Antigravity 2.x (`%LOCALAPPDATA%\Programs\Antigravity`), optional Antigravity IDE (`%LOCALAPPDATA%\Programs\Antigravity IDE`), Node.js.
- Prompt user to run in an **external PowerShell** window in repo root:
  ```powershell
  .\install.ps1 -KillRunning
  ```
  *(Pass `-SkipIde` to theme only main Antigravity without hooking Antigravity IDE.)*
- Re-launch Antigravity (and Antigravity IDE if installed).

#### B. Programmatic Customization
- List presets (`kanagawa-wave`, `kanagawa-dragon`, `sakura-dusk`, `midnight-aqua`, `tokyo-night`, `nordic-frost`):
  ```powershell
  node scripts/apply_kanagawa_config.js --list-presets
  ```
- Switch preset:
  ```powershell
  .\customize-kanagawa.ps1 -Preset sakura-dusk
  ```
- Set wallpaper, position, scrim style & effects:
  ```powershell
  .\customize-kanagawa.ps1 -Wallpaper "C:\path\to\bg.jpg" -WallpaperPosition "center center" -ScrimStyle gradient -WpBlur 6
  ```
- Disable wallpaper (solid theme background only):
  ```powershell
  .\customize-kanagawa.ps1 -NoWallpaper
  ```
  *(Equivalent to `-Wallpaper NONE` or `"wallpaper": "NONE"` / `"off"` / `""` in `kanagawa.config.json`.)*
- Set avatars & per-avatar geometry (use `-AgentAvatar SVG_STAR` to restore the built-in gradient star):
  ```powershell
  .\customize-kanagawa.ps1 -UserAvatar "C:\path\to\user.png" -AgentAvatar "C:\path\to\agent.png" -UserAvatarSize 40 -AgentAvatarRotate 0 -UserAvatarVisible "true"
  ```
- Quick hex overrides, loading & Studio flags (`.\customize-kanagawa.ps1 -Help` / `node scripts/apply_kanagawa_config.js --help` for full list):
  - Colors: `-DarkPrimary`, `-DarkBlue`, `-DarkAqua`, `-DarkSurface`, `-DarkChrome`, `-DarkSidebar`, `-DarkOverlay`, `-DarkScrim`, `-DarkSelection`, `-LightPrimary`, `-LightChrome`, `-LightSurface`
  - Loading & Studio: `-LoadingTitle`, `-LoadingSubtitle`, `-LoadingStyle kanagawa-wave|minimal|terminal`, `-LoadingShowEmblem "true|false"`, `-LoadingShowProgress "true|false"`, `-StudioPill "true|false"`, `-StudioPillPos`, `-StudioLang vi|en`
- Full palette / gradient / loading text edit: Update `kanagawa-theme/kanagawa.config.json` (`dark.*`, `light.*`, `agentAvatar.bgStops`, `agentAvatar.iconStops`, `loading.title`, `loading.subtitle`), then run `.\customize-kanagawa.ps1` (pass `-NoReload` to skip CDP reload).

#### C. Config Portability Note
When an image path outside `kanagawa-theme/` is applied, `theme-builder.js` copies the asset into `kanagawa-theme/assets/library/` and stores a portable `"library:<filename>"` reference in `kanagawa.config.json` (while embedding the Data URL inside `KANAGAWA-EMBEDDED-ASSETS` in `kanagawa.css`), keeping `kanagawa.config.json` free of local machine paths. Built-in preset profiles set `preserveWallpaper` / `preserveAvatars` so switching presets keeps active user media intact (`minimal-clean` sets `wallpaper: "NONE"`).

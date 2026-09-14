<div align="center">

# TrackCast

**Show your currently playing Spotify track as a live overlay in OBS Studio.**

A lightweight Electron desktop app that polls the Spotify *currently playing* endpoint and shows the track in OBS Studio as a styled, animated browser overlay (or a plain text source). A first-run wizard handles the entire setup, including adding the overlay to OBS — no manual config file editing.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/develoverli/trackcast)](https://github.com/develoverli/trackcast/releases/latest)
[![Made with Electron](https://img.shields.io/badge/Electron-33-47848F.svg)](https://www.electronjs.org/)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Keep TrackCast free on Ko-fi](https://img.shields.io/badge/Ko--fi-Keep%20TrackCast%20free-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/develover)

<img width="868" height="587" alt="TrackCast main window showing the currently playing Spotify track and the OBS connection status" src="https://github.com/user-attachments/assets/b0260f84-b1ce-48b1-a8d9-e14273608ca5" />
</div>

---

## Features

- **First-run setup wizard** — guided Spotify OAuth + OBS connection, no editing files by hand.
- **Live track polling** — configurable interval (default 5s).
- **Automatic token refresh** — Spotify access tokens refresh before they expire.
- **OBS auto-reconnect** — reconnects with backoff if OBS drops.
- **System tray** — minimize to tray, tray status icon (idle / playing / error).
- **Auto-start with Windows** — optional launch on login.
- **In-app auto-updates** — pulls new releases from GitHub.
- **Browser overlay for OBS** — Card, Compact, or Minimal layouts with album art, progress bar, corner, animation, size, and your own labels. Added to OBS with one click, with a live preview in the app.
- **12 overlay themes** — TrackCast, Midnight, Neon Arcade, Synthwave, Pixel, Terminal, Hype, Elegant, Kawaii, Lo-fi, Ocean, and Mono, each with its own colors, font, borders, and effects. Tweak any of them and save your own.
- **Styled text source** — or send plain text to an OBS Text (GDI+) source with 8 text themes (Clean, Neon, Hype, Terminal, Elegant, Gold, Kawaii, Subtle). Style and text changes reach OBS as soon as you save.

## Requirements

- **OBS Studio** with the built-in WebSocket server enabled (v5 — bundled with OBS 28+).
- A **Spotify account** (Free or Premium) and a free **Spotify Developer app**.
- Windows 10/11 (the packaged build targets Windows; see [Build from source](#build-from-source)).

## Install

### Option A — Download the installer (recommended)

1. Go to the [**Releases**](https://github.com/develoverli/trackcast/releases) page.
2. Download the latest `TrackCast-Setup-<version>.exe`.
3. Run the installer (you can choose the install directory). The setup wizard opens on first launch.

Installed copies update themselves automatically from GitHub Releases. Running a newer installer over an existing installation switches to **update mode**: it skips the license and folder pages, keeps your settings, and closes TrackCast if it is running.

### Option B — Run from source

Requires [Node.js](https://nodejs.org/) 22+ and [pnpm](https://pnpm.io/) 11+ (`corepack enable` picks the pinned version).

```bash
git clone https://github.com/develoverli/trackcast.git
cd trackcast
pnpm install
pnpm start
```

## Setup

Before first run, prepare the two integrations. The in-app wizard walks you through all of this — the summary below is for reference.

### 1. Create a Spotify Developer app

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and sign in.
2. Click **Create app** (name and description can be anything).
3. Under **Redirect URIs** add exactly:
   ```
   http://127.0.0.1:8888/callback
   ```
   Spotify no longer accepts `localhost` redirect URIs — use the `127.0.0.1` address exactly as shown.
4. Save, then open **Settings** to copy your **Client ID** and **Client Secret**.

### 2. Enable OBS WebSocket

1. In OBS Studio: **Tools → WebSocket Server Settings**.
2. Check **Enable WebSocket server**.
3. Set a server password (note it down). Default port is `4455`.
4. Click **OK**.

### 3. Add the overlay to OBS

The wizard does this for you: in step 3 choose **Browser overlay**, pick a theme and layout, and click **Add to OBS**. Later, open **Overlay** in the sidebar to switch themes, customize colors, fonts, borders and effects, or save your own themes. TrackCast creates a **TrackCast Overlay** browser source in your current scene that covers the whole canvas, so you don't need to resize it.

To add it manually instead, create a **Browser** source in OBS with:

- **URL:** `http://127.0.0.1:8890/overlay` (shown in the **Overlay** module)
- **Width / Height:** your OBS base canvas resolution (for example `1920` × `1080`)

Prefer plain text? Choose **Text source** in step 3 and click **Check or create it in OBS**.

### 4. Run the wizard

Launch TrackCast and follow the three steps:

1. **Spotify** — copy the suggested app name, description, and Redirect URI into the Spotify form with one click, paste your Client ID + Secret, then click *Authorize*; your browser opens, approve, return to the app.
2. **OBS** — enter host (`localhost`), port (`4455`) and password, then test the connection.
3. **Overlay** — pick a layout and style with a live preview, then click **Add to OBS**.
4. **Behavior** — polling interval, tray, and startup options. TrackCast starts updating OBS right away.

## Configuration

All settings live in `config.json`, created on first run in the app's user data folder:

```
%APPDATA%\TrackCast\config.json
```

Edit everything through the in-app **Settings** view — no manual file editing needed. A reference template ships as [`config.json.example`](config.json.example).

| Section | Keys | Description |
|---------|------|-------------|
| `spotify` | `clientId`, `clientSecret`, `redirectUri`, `refreshToken` | Spotify OAuth credentials |
| `obs` | `host`, `port`, `password`, `textSourceName`, `outputMode` | OBS WebSocket connection. `outputMode`: `overlay`, `text`, or `both` |
| `browserOverlay` | `port`, `theme`, `layout`, `accent`, `accent2`, `surfaceColor`, `surfaceOpacity`, `textColor`, `font`, `radius`, `border`, `effect`, `uppercaseTitle`, `corner`, `animation`, `scale`, `showAlbumArt`, `showArtist`, `showAlbum`, `showProgress`, `whenPaused`, `idleMessage`, `labels.nowPlaying`, `labels.paused` | Browser overlay served at `http://127.0.0.1:<port>/overlay` (default port `8890`) |
| `customThemes` | `overlay[]`, `text[]` | Themes you saved: `{ id, name, style }` |
| `polling` | `intervalMs`, `enabled` | Polling cadence (default `5000` ms) |
| `overlay` | `format`, `idleText`, `showOnlyWhenPlaying`, `textTheme`, `textStyle` | Text source template (placeholders `{trackName}`, `{artistName}`) and its OBS style (font, size, colors, gradient, outline, background) |
| `behavior` | `startMinimized`, `minimizeToTray`, `autoStartWithWindows`, `autoReconnect` | UX behavior |

> [!WARNING]
> `config.json` stores your Spotify Client Secret, refresh token, and OBS password **in plain text**. Never share this file or attach it to an issue.

## Build from source

Build the Windows NSIS installer:

```bash
pnpm build
```

Output (`TrackCast-Setup-<version>.exe`, `latest.yml`, blockmap) lands in `dist/`.

Branding assets are generated by Python scripts. You only need them if you change the artwork:

| Script | Output | Requirements |
|--------|--------|--------------|
| [`scripts/generate-icon.py`](scripts/generate-icon.py) | App, tray and `build/icon.ico` icons | Python 3, [Pillow](https://pypi.org/project/pillow/) |
| [`scripts/generate-installer-images.py`](scripts/generate-installer-images.py) | `build/installerSidebar.bmp`, `build/installerHeader.bmp` | Python 3, Pillow, [fontTools](https://pypi.org/project/fonttools/) (`pip install pillow "fonttools[woff]"`) |

Both scripts share the artwork helpers in [`scripts/branding.py`](scripts/branding.py). Installer behavior (update, reinstall, and downgrade detection) is customized in [`build/installer.nsh`](build/installer.nsh).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **"OBS WebSocket is not reachable"** | The WebSocket server is off. In OBS open **Tools → WebSocket Server Settings**, check **Enable WebSocket server**, and make sure the port matches TrackCast. |
| **"OBS rejected the password"** | Copy the password from **Tools → WebSocket Server Settings → Show Connect Info** into **Settings → OBS**. |
| **Overlay not showing in OBS** | Keep TrackCast running and check that the Browser Source URL matches the **Overlay** module. With *When music is paused* set to *Hide*, the overlay only appears while a song plays. |
| **"Port 8890 is already in use"** | Another app uses the overlay port. Change it in **Overlay → Customize → Advanced**, save, then click **Add to OBS** again. |
| **OBS source not updating** | Verify the text source name in OBS matches `obs.textSourceName` **exactly** (case-sensitive). |
| **OBS connection fails** | Confirm the OBS WebSocket server is enabled and the password matches. Check that Windows Firewall isn't blocking port `4455`. |
| **`client_id: Invalid` on the Spotify page** | The Client ID field has the wrong value (often the Redirect URI). Copy the **Client ID** from your app's **Settings** in the Spotify Dashboard; it is 32 letters and numbers. |
| **Spotify auth fails** | The Redirect URI in the Spotify dashboard must be **exactly** `http://127.0.0.1:8888/callback` (no trailing slash). |
| **"This redirect URI is not secure"** | Spotify rejects `localhost`. Use `http://127.0.0.1:8888/callback` instead. Upgrading from 1.0.0? TrackCast migrates your config automatically — update the URI in your Spotify app and re-authorize from the banner on Home. |
| **"Port 8888 is already in use"** | Another app is using port `8888`. Close it and click *Authorize* again. |
| **"Token expired" errors** | The app auto-refreshes tokens ~5 min before expiry. If it persists, re-authorize from **Settings → Spotify**. |
| **Tray icon stays grey** | Polling is paused, nothing is playing, or the Spotify connection dropped. Resume polling from the sidebar footer. |

Detailed logs: `%APPDATA%\TrackCast\logs\main.log`. Include the last ~100 lines when [reporting a bug](https://github.com/develoverli/trackcast/issues/new/choose) — remove any tokens or passwords first.

## Tech stack

Electron 33 · ESM · [obs-websocket-js](https://github.com/obs-websocket-community-projects/obs-websocket-js) v5 · axios · electron-updater · electron-log · pnpm

## Contributing

Contributions are welcome — bug reports, feature ideas, and pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get set up and what to expect. This project follows a [Code of Conduct](CODE_OF_CONDUCT.md).

Found a security issue? Please **don't** open a public issue — see [SECURITY.md](SECURITY.md).

Release history: [CHANGELOG.md](CHANGELOG.md).

## Acknowledgements

TrackCast is built on top of these open-source projects:

- [Electron](https://www.electronjs.org/) — MIT
- [obs-websocket-js](https://github.com/obs-websocket-community-projects/obs-websocket-js) — MIT
- [axios](https://github.com/axios/axios) — MIT
- [electron-updater / electron-builder](https://github.com/electron-userland/electron-builder) — MIT
- [electron-log](https://github.com/megahertz/electron-log) — MIT
- [Inter](https://rsms.me/inter/) typeface by The Inter Project Authors — [SIL Open Font License 1.1](src/renderer/assets/fonts/Inter-OFL.txt)
- [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans) typeface by The Plus Jakarta Sans Project Authors — [SIL Open Font License 1.1](src/renderer/assets/fonts/PlusJakartaSans-OFL.txt)
- Overlay theme typefaces, all under the SIL Open Font License 1.1: [Anton](src/renderer/assets/fonts/Anton-OFL.txt), [Space Grotesk](src/renderer/assets/fonts/SpaceGrotesk-OFL.txt), [Playfair Display](src/renderer/assets/fonts/PlayfairDisplay-OFL.txt), [Press Start 2P](src/renderer/assets/fonts/PressStart2P-OFL.txt), [JetBrains Mono](src/renderer/assets/fonts/JetBrainsMono-OFL.txt), [Fredoka](src/renderer/assets/fonts/Fredoka-OFL.txt)

## Disclaimer

TrackCast is an independent, community project. It is **not affiliated with, endorsed by, or sponsored by Spotify AB or the OBS Project**. Spotify is a trademark of Spotify AB. OBS and OBS Studio are trademarks of the OBS Project. All other trademarks are the property of their respective owners.

Use of the Spotify Web API is subject to the [Spotify Developer Terms](https://developer.spotify.com/terms).

## License

[MIT](LICENSE) © 2026 develoverli

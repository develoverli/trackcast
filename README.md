<div align="center">

# TrackCast

**Show your currently playing Spotify track as a live overlay in OBS Studio.**

A lightweight Electron desktop app that polls the Spotify *currently playing* endpoint and pushes the track text to an OBS text source over OBS WebSocket. A first-run wizard handles the entire setup — no manual config file editing.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/develoverli/trackcast)](https://github.com/develoverli/trackcast/releases/latest)
[![Made with Electron](https://img.shields.io/badge/Electron-33-47848F.svg)](https://www.electronjs.org/)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

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
- **Customizable overlay text** — template with `{trackName}` and `{artistName}` placeholders.

## Requirements

- **OBS Studio** with the built-in WebSocket server enabled (v5 — bundled with OBS 28+).
- A **Spotify account** (Free or Premium) and a free **Spotify Developer app**.
- Windows 10/11 (the packaged build targets Windows; see [Build from source](#build-from-source)).

## Install

### Option A — Download the installer (recommended)

1. Go to the [**Releases**](https://github.com/develoverli/trackcast/releases) page.
2. Download the latest `TrackCast.Setup.<version>.exe`.
3. Run the installer (you can choose the install directory). The setup wizard opens on first launch.

Installed copies update themselves automatically from GitHub Releases.

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
   http://localhost:8888/callback
   ```
4. Save, then open **Settings** to copy your **Client ID** and **Client Secret**.

### 2. Enable OBS WebSocket

1. In OBS Studio: **Tools → WebSocket Server Settings**.
2. Check **Enable WebSocket server**.
3. Set a server password (note it down). Default port is `4455`.
4. Click **OK**.

### 3. Add a text source in OBS

1. In your scene, add a **Text (GDI+)** source.
2. Give it a name (e.g. `SpotifyNowPlaying`) — you'll enter this exact name in the wizard.
3. Style/position it in OBS however you like.

### 4. Run the wizard

Launch TrackCast and follow the three steps:

1. **Spotify** — paste Client ID + Secret, click *Authorize*; your browser opens, approve, return to the app.
2. **OBS** — enter host (`localhost`), port (`4455`), password, and the text source name.
3. **Done** — the app starts polling and updating your OBS text source.

## Configuration

All settings live in `config.json`, created on first run in the app's user data folder:

```
%APPDATA%\TrackCast\config.json
```

Edit everything through the in-app **Settings** view — no manual file editing needed. A reference template ships as [`config.json.example`](config.json.example).

| Section | Keys | Description |
|---------|------|-------------|
| `spotify` | `clientId`, `clientSecret`, `redirectUri`, `refreshToken` | Spotify OAuth credentials |
| `obs` | `host`, `port`, `password`, `textSourceName` | OBS WebSocket connection |
| `polling` | `intervalMs`, `enabled` | Polling cadence (default `5000` ms) |
| `overlay` | `format`, `idleText`, `showOnlyWhenPlaying`, `showAlbumArt` | Overlay text template — placeholders `{trackName}`, `{artistName}`. `showAlbumArt` is reserved for a future release. |
| `behavior` | `startMinimized`, `minimizeToTray`, `autoStartWithWindows`, `autoReconnect` | UX behavior |

> [!WARNING]
> `config.json` stores your Spotify Client Secret, refresh token, and OBS password **in plain text**. Never share this file or attach it to an issue.

## Build from source

Build the Windows NSIS installer:

```bash
pnpm build
```

Output (`TrackCast Setup <version>.exe`, `latest.yml`, blockmap) lands in `dist/`.

The app icon is generated by [`scripts/generate-icon.py`](scripts/generate-icon.py), which requires Python 3 and [Pillow](https://pypi.org/project/pillow/) (`pip install pillow`). You only need it if you change the icon.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **OBS source not updating** | Verify the text source name in OBS matches `obs.textSourceName` **exactly** (case-sensitive). |
| **OBS connection fails** | Confirm the OBS WebSocket server is enabled and the password matches. Check that Windows Firewall isn't blocking port `4455`. |
| **Spotify auth fails** | The Redirect URI in the Spotify dashboard must be **exactly** `http://localhost:8888/callback` (no trailing slash). |
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
- [dotenv](https://github.com/motdotla/dotenv) — BSD-2-Clause
- [Inter](https://rsms.me/inter/) typeface by The Inter Project Authors — [SIL Open Font License 1.1](src/renderer/assets/fonts/OFL.txt)

## Disclaimer

TrackCast is an independent, community project. It is **not affiliated with, endorsed by, or sponsored by Spotify AB or the OBS Project**. Spotify is a trademark of Spotify AB. OBS and OBS Studio are trademarks of the OBS Project. All other trademarks are the property of their respective owners.

Use of the Spotify Web API is subject to the [Spotify Developer Terms](https://developer.spotify.com/terms).

## License

[MIT](LICENSE) © 2026 develoverli

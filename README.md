<div align="center">

# TrackCast

**Show your currently playing Spotify track as a live overlay in OBS Studio.**

A lightweight Electron desktop app that polls the Spotify *currently playing* endpoint and pushes the track text to an OBS text source over OBS WebSocket. A first-run wizard handles the entire setup — no manual config file editing.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Made with Electron](https://img.shields.io/badge/Electron-33-47848F.svg)](https://www.electronjs.org/)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

<img width="868" height="587" alt="image" src="https://github.com/user-attachments/assets/b0260f84-b1ce-48b1-a8d9-e14273608ca5" />
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
- Windows 10/11 (the packaged build targets Windows; see [Build from source](#build-from-source) for other platforms).

## Install

### Option A — Download the app (recommended)

1. Go to the [**Releases**](https://github.com/coldevotion/trackcast/releases) page.
2. Download the latest `TrackCast-*.exe` (portable — no installer needed).
3. Run it. The setup wizard opens on first launch.

### Option B — Run from source

Requires [Node.js](https://nodejs.org/) 18+ and [pnpm](https://pnpm.io/).

```bash
git clone https://github.com/coldevotion/trackcast.git
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

All settings live in `config.json`, created on first run next to the app. Edit everything through the in-app **Settings** view — no manual file editing needed.

| Section | Keys | Description |
|---------|------|-------------|
| `spotify` | `clientId`, `clientSecret`, `redirectUri`, `refreshToken` | Spotify OAuth credentials |
| `obs` | `host`, `port`, `password`, `textSourceName` | OBS WebSocket connection |
| `polling` | `intervalMs`, `enabled` | Polling cadence (default `5000` ms) |
| `overlay` | `format`, `idleText`, `showOnlyWhenPlaying` | Overlay text template — placeholders `{trackName}`, `{artistName}` |
| `behavior` | `startMinimized`, `minimizeToTray`, `autoStartWithWindows`, `autoReconnect` | UX behavior |

## Build from source

Build a portable Windows executable:

```bash
pnpm build
```

Output lands in `dist/`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **OBS source not updating** | Verify the text source name in OBS matches `obs.textSourceName` **exactly** (case-sensitive). |
| **OBS connection fails** | Confirm the OBS WebSocket server is enabled and the password matches. Check that Windows Firewall isn't blocking port `4455`. |
| **Spotify auth fails** | The Redirect URI in the Spotify dashboard must be **exactly** `http://localhost:8888/callback` (no trailing slash). |
| **"Token expired" errors** | The app auto-refreshes tokens ~5 min before expiry. If it persists, re-authorize from **Settings → Spotify**. |
| **Tray icon stays grey** | Polling is paused, nothing is playing, or the Spotify connection dropped. Resume polling from the sidebar footer. |

Detailed logs: `%APPDATA%\TrackCast\logs\main.log`. Include the last ~100 lines when reporting a bug.

## Tech stack

Electron 33 · ESM · [obs-websocket-js](https://github.com/obs-websocket-community-projects/obs-websocket-js) v5 · axios · electron-updater · electron-log · pnpm

## Contributing

Contributions are welcome — bug reports, feature ideas, and pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get set up and what to expect.

## License

[MIT](LICENSE) © 2026 coldevotion

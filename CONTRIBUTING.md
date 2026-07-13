# Contributing to TrackCast

Thanks for your interest in improving TrackCast! Bug reports, feature ideas, docs fixes, and pull requests are all welcome.

## Ways to contribute

- **Report a bug** — open an [issue](https://github.com/coldevotion/trackcast/issues) with steps to reproduce, your OS, OBS version, and the relevant lines from `%APPDATA%\TrackCast\logs\main.log`.
- **Suggest a feature** — open an issue describing the use case before writing code, so we can agree on scope.
- **Send a pull request** — fix a bug, improve docs, or implement an agreed feature.

## Development setup

Requires [Node.js](https://nodejs.org/) 18+ and [pnpm](https://pnpm.io/).

```bash
git clone https://github.com/coldevotion/trackcast.git
cd trackcast
pnpm install
pnpm dev      # runs the app with DevTools open
```

Useful scripts:

| Command | Purpose |
|---------|---------|
| `pnpm start` | Run the app |
| `pnpm dev` | Run the app with DevTools |
| `pnpm build` | Build the portable Windows EXE into `dist/` |

## Project layout

```
src/
├── main.js            # Electron main process (entry)
├── preload.mjs        # contextBridge to the renderer (must stay .mjs)
├── configManager.js   # config.json load/save
├── spotify.js         # Spotify Web API (token refresh, currently-playing)
├── obs.js             # OBS WebSocket v5 client
├── updater.js         # auto-update (electron-updater)
├── autoLaunch.js      # Windows startup integration
└── renderer/          # Wizard + settings UI (HTML/CSS/JS)
```

## Conventions

- **Package manager is pnpm.** Don't commit a `package-lock.json` or `yarn.lock`.
- **ESM only** — the project is `"type": "module"`. Use top-level `import`, not `require()`.
- **OBS WebSocket v5 API** — use `obs.call(...)` / `obs.connect(...)`. Don't reintroduce the v0.x API (`obs.send(...)`).
- **No secrets in code or commits.** `config.json` and `.env` are gitignored — keep it that way.
- **Preload must stay `src/preload.mjs`** with `webPreferences.sandbox: false` (Electron ESM preload requirement).
- Keep changes focused — one logical change per pull request.

## Pull request checklist

Before opening a PR:

1. The app runs (`pnpm start`) without new errors in the console.
2. Your change is scoped to what the PR describes — no unrelated refactors.
3. Docs (README/this file) updated if behavior or setup changed.
4. Reference the related issue in the PR description.

## Code of conduct

Be respectful and constructive. Harassment or hostile behavior isn't tolerated in issues, PRs, or discussions.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).

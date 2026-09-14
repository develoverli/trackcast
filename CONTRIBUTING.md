# Contributing to TrackCast

Thanks for your interest in improving TrackCast! Bug reports, feature ideas, docs fixes, and pull requests are all welcome.

## Ways to contribute

- **Report a bug** — open a [bug report](https://github.com/develoverli/trackcast/issues/new?template=bug_report.yml) with steps to reproduce, your OS, OBS version, and the relevant lines from `%APPDATA%\TrackCast\logs\main.log` (remove tokens and passwords first).
- **Suggest a feature** — open a [feature request](https://github.com/develoverli/trackcast/issues/new?template=feature_request.yml) describing the use case before writing code, so we can agree on scope.
- **Send a pull request** — fix a bug, improve docs, or implement an agreed feature.
- **Report a vulnerability** — never in a public issue. Follow [SECURITY.md](SECURITY.md).

## Development setup

Requires [Node.js](https://nodejs.org/) 22+ and [pnpm](https://pnpm.io/) 11+. The exact pnpm version is pinned in `package.json` (`packageManager`) — run `corepack enable` to use it.

```bash
git clone https://github.com/develoverli/trackcast.git
cd trackcast
pnpm install
pnpm dev      # runs the app with DevTools open
```

Useful scripts:

| Command | Purpose |
|---------|---------|
| `pnpm start` | Run the app |
| `pnpm dev` | Run the app with DevTools |
| `pnpm build` | Build the Windows NSIS installer into `dist/` |

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
- **Update [CHANGELOG.md](CHANGELOG.md)** under `[Unreleased]` for any user-facing change.
- Keep changes focused — one logical change per pull request.

## Pull request checklist

Before opening a PR:

1. The app runs (`pnpm start`) without new errors in the console.
2. Your change is scoped to what the PR describes — no unrelated refactors.
3. Docs (README/this file) updated if behavior or setup changed.
4. `CHANGELOG.md` updated under `[Unreleased]` for user-facing changes.
5. Reference the related issue in the PR description.

## Code of conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).

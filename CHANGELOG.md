# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Project ownership moved to [develoverli](https://github.com/develoverli); repository, update feed, and copyright now point to `develoverli/trackcast`.
- Pinned toolchain: Node.js 22+ and pnpm 11 (`packageManager` / `engines` in `package.json`).
- README now documents the NSIS installer and the real `config.json` location.

### Added

- Code of Conduct, security policy, issue forms, and pull request template.
- Acknowledgements and trademark disclaimer in the README.
- SIL Open Font License text for the bundled Inter typeface.

### Removed

- `.env.example` and the legacy `.env` fallback (`dotenv` dependency) — configuration is handled by the setup wizard and `config.json`.
- Unused `overlay.showAlbumArt` config key.

## [1.0.0] - 2026-07-13

### Added

- First-run setup wizard with Spotify OAuth and OBS WebSocket connection.
- Live polling of the Spotify *currently playing* track with configurable interval.
- Automatic Spotify access token refresh.
- OBS WebSocket v5 client with auto-reconnect.
- System tray with idle / playing / error status icons and minimize to tray.
- Optional auto-start with Windows.
- In-app auto-updates from GitHub Releases.
- Customizable overlay text template with `{trackName}` and `{artistName}` placeholders.
- Windows NSIS installer.

[Unreleased]: https://github.com/develoverli/trackcast/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/develoverli/trackcast/releases/tag/v1.0.0

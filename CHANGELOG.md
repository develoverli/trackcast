# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Spotify authorization: the redirect URI is now `http://127.0.0.1:8888/callback`, since Spotify no longer accepts `localhost`. Saved configs are migrated automatically, and a banner on Home guides existing users to update their Spotify app and re-authorize.
- Spotify authorization never completed: the token exchange was blocked by the renderer's Content Security Policy and a missing element threw after saving tokens.
- *Re-authorize Spotify* in Settings was hidden, ignored the Settings fields, and gave no feedback.

- The update listener crashed because it referenced elements that did not exist.
- Settings had a close button that jumped back to the setup wizard.
- Authorizing with a malformed Client ID opened Spotify with `client_id: Invalid`; the app now blocks it and explains what to copy.

### Security

- The token exchange now runs in the main process, so the Client Secret is no longer sent from the renderer.
- The OAuth callback server listens only on the loopback interface and validates the OAuth `state` parameter.
- The renderer Content Security Policy no longer allows connections to `localhost`.

### Changed

- Project ownership moved to [develoverli](https://github.com/develoverli); repository, update feed, and copyright now point to `develoverli/trackcast`.
- Pinned toolchain: Node.js 22+ and pnpm 11 (`packageManager` / `engines` in `package.json`).
- README now documents the NSIS installer and the real `config.json` location.
- Default window size is now 1040 × 720.
- Installer file name is now `TrackCast-Setup-<version>.exe`, matching the name referenced by the auto-update feed.
- Font licenses are now stored per typeface (`Inter-OFL.txt`, `PlusJakartaSans-OFL.txt`).

### Added

- Redesigned interface: new welcome screen, step-by-step setup with a progress bar, refreshed Home, Settings, and Help views, and a sidebar status card with a tracking switch.
- One-click **Copy** buttons in the setup wizard for the Spotify app name, description, website, and Redirect URI, plus the OBS text source name.
- **Paste** buttons and show/hide toggles for the Client ID, Client secret, and OBS password.
- *Settings → About* shows the real app version and links to the GitHub repository.
- Plus Jakarta Sans typeface for headings.
- New app, tray, and installer icons matching the redesign.
- Client ID and Client secret are validated as you type or paste: pasting anything that is not a 32-character Spotify credential (for example the Redirect URI) shows an inline error instead of filling the field.
- Branded Windows installer: TrackCast artwork on the welcome, finish, and header areas, an MIT license page, and a *Launch TrackCast* option when setup finishes.
- Installer update mode: running the installer over an existing installation detects the installed version and offers *Update* or *Reinstall*, skipping the license and folder pages. Installing an older version asks for confirmation first.
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

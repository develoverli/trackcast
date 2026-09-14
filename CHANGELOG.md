# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Browser overlay for OBS**: a transparent, animated overlay served by TrackCast at `http://127.0.0.1:8890/overlay`, with Card, Compact, and Minimal layouts, album art, progress bar, accent color, background, corner, entrance animation, font, size, editable labels, and a configurable paused state (hide, show as paused, or a custom message). Style changes reach OBS instantly.
- **Overlay module** in the sidebar with a large live preview, a *Themes* gallery, and a *Customize* tab. Unsaved changes show a sticky *Save / Discard* bar.
- **12 overlay themes** with distinct personalities (TrackCast, Midnight, Neon Arcade, Synthwave, Pixel, Terminal, Hype, Elegant, Kawaii, Lo-fi, Ocean, Mono) and new style controls: second accent, background color and opacity, text color, font, corners, border (including gradient), effect (shadow, neon glow, hard shadow, text shadow), and uppercase titles.
- **8 text source themes** (Clean, Neon, Hype, Terminal, Elegant, Gold, Kawaii, Subtle) using Windows fonts, a full text style editor (font, size, bold, italic, uppercase, color, gradient, outline, background), and *Apply style to OBS*.
- **My themes**: save, rename, duplicate, and delete your own overlay and text themes.
- Six theme typefaces: Anton, Space Grotesk, Playfair Display, Press Start 2P, JetBrains Mono, and Fredoka.
- **Add to OBS** button that creates (or updates) a *TrackCast Overlay* browser source in the current scene, sized to the OBS canvas, plus a live preview in the app.
- Output mode setting: browser overlay, text source, or both. Existing installations keep using the text source.
- Redesigned interface: new welcome screen, step-by-step setup with a progress bar, refreshed Home, Settings, and Help views, and a sidebar status card with a tracking switch.
- One-click **Copy** buttons in the setup wizard for the Spotify app name, description, website, and Redirect URI, plus the OBS text source name.
- **Paste** buttons and show/hide toggles for the Client ID, Client secret, and OBS password.
- Client ID and Client secret are validated as you type or paste: pasting anything that is not a 32-character Spotify credential (for example the Redirect URI) shows an inline error instead of filling the field.
- *Settings → About* shows the real app version and links to the GitHub repository.
- Plus Jakarta Sans typeface for headings.
- New app, tray, and installer icons matching the redesign.
- Branded Windows installer: TrackCast artwork on the welcome, finish, and header areas, an MIT license page, and a *Launch TrackCast* option when setup finishes.
- Installer update mode: running the installer over an existing installation detects the installed version and offers *Update* or *Reinstall*, skipping the license and folder pages. Installing an older version asks for confirmation first.
- Code of Conduct, security policy, issue forms, and pull request template.
- Acknowledgements and trademark disclaimer in the README.
- SIL Open Font License text for the bundled typefaces.

### Changed

- Setup wizard step 2 now only handles the OBS connection; step 3 picks the output, theme, layout, and corner. The full editor lives in the new *Overlay* module instead of Settings.
- The overlay `background` setting (dark, solid, light, transparent) became background color and opacity; existing configs are migrated automatically.
- Project ownership moved to [develoverli](https://github.com/develoverli); repository, update feed, and copyright now point to `develoverli/trackcast`.
- Pinned toolchain: Node.js 22+ and pnpm 11 (`packageManager` / `engines` in `package.json`).
- README now documents the NSIS installer and the real `config.json` location.
- Default window size is now 1040 × 720.
- Installer file name is now `TrackCast-Setup-<version>.exe`, matching the name referenced by the auto-update feed.
- Font licenses are now stored per typeface (`Inter-OFL.txt`, `PlusJakartaSans-OFL.txt`).

### Removed

- `.env.example` and the legacy `.env` fallback (`dotenv` dependency) — configuration is handled by the setup wizard and `config.json`.
- Unused `overlay.showAlbumArt` config key.

### Fixed

- Spotify authorization: the redirect URI is now `http://127.0.0.1:8888/callback`, since Spotify no longer accepts `localhost`. Saved configs are migrated automatically, and a banner on Home guides existing users to update their Spotify app and re-authorize.
- Spotify authorization never completed: the token exchange was blocked by the renderer's Content Security Policy and a missing element threw after saving tokens.
- Authorizing with a malformed Client ID opened Spotify with `client_id: Invalid`; the app now blocks it and explains what to copy.
- *Re-authorize Spotify* in Settings was hidden, ignored the Settings fields, and gave no feedback.
- Home did not clear the track when Spotify stopped playing.
- OBS connection errors were hidden: *Test connection* always reported success, and every failure said "Not connected". TrackCast now shows the real cause (WebSocket server turned off, wrong password, or OBS too old), writes it to the log, and reconnects automatically when OBS closes and reopens.
- A newly created text source could appear as a thin, tall vertical bar because it was created empty; it now starts with the current song or a placeholder and saves the chosen output mode first, so it keeps updating.
- *Check or create it in OBS* created an unstyled Arial text source at the top-left corner and ignored its style settings. It now picks the current OBS text source type (Text GDI+ v3, or FreeType outside Windows), uses bold white text with a black outline, and places it in the overlay corner.
- The update listener crashed because it referenced elements that did not exist.
- Settings had a close button that jumped back to the setup wizard.

### Security

- The token exchange now runs in the main process, so the Client Secret is no longer sent from the renderer.
- The OAuth callback server listens only on the loopback interface and validates the OAuth `state` parameter.
- The overlay server listens only on the loopback interface, accepts only `GET` requests, and never exposes credentials.
- The renderer Content Security Policy no longer allows connections to `localhost`.

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

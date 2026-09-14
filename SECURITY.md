# Security Policy

## Supported versions

Only the latest release receives security fixes. Installed copies update automatically from GitHub Releases.

| Version | Supported |
|---------|-----------|
| 1.x (latest) | :white_check_mark: |
| < latest | :x: |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, pull requests, or discussions.**

Report privately through GitHub's private vulnerability reporting:

1. Go to the [**Security** tab](https://github.com/develoverli/trackcast/security) of this repository.
2. Click **Report a vulnerability** ([direct link](https://github.com/develoverli/trackcast/security/advisories/new)).
3. Include as much of the following as you can:
   - Type of issue (e.g. credential exposure, remote code execution, insecure update channel).
   - Affected version and file(s).
   - Step-by-step instructions to reproduce.
   - Proof of concept, if available.
   - Impact — what an attacker could achieve.

**Never include your real Spotify tokens, client secret, or OBS password in a report.**

## What to expect

- Acknowledgement within **7 days**.
- A status update (confirmed / not reproducible / needs more info) within **14 days**.
- Once fixed, a new release is published and the advisory is disclosed with credit to the reporter (unless you prefer to stay anonymous).

## Scope notes

TrackCast is a local desktop app. Keep in mind:

- `config.json` (`%APPDATA%\TrackCast\config.json`) stores the Spotify client secret, refresh token, and OBS password **in plain text**, protected only by your Windows user account.
- During authorization, the OAuth callback server listens only on the loopback interface (`http://127.0.0.1:8888/callback`) and validates the OAuth `state` parameter.
- Auto-updates are downloaded from this repository's GitHub Releases.

Issues in Spotify, OBS Studio, or third-party dependencies should be reported to their respective maintainers.

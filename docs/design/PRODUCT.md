# TrackCast — Product

## What it is

TrackCast is a Windows desktop app (Electron) that shows the currently playing Spotify track as a live text overlay in OBS Studio. It polls the Spotify Web API and pushes the formatted text to an OBS text source over OBS WebSocket v5.

## Who it's for

- **Streamers and content creators** who use OBS Studio and want a "now playing" overlay without writing scripts.
- Mostly non-developers: they can follow instructions, but creating a Spotify Developer app, OAuth, and WebSocket settings are unfamiliar territory.

## Core jobs

1. **Set up once, fast.** A guided wizard connects Spotify and OBS with as little typing as possible (copy buttons, suggested values, clear errors).
2. **Forget about it.** Runs in the system tray, starts with Windows, reconnects on its own, and auto-updates.
3. **Know it's working at a glance.** Home shows the current track and whether it is reaching OBS; the tray icon reflects idle / playing / error.

## Product principles

- **Setup is the product.** Most users judge TrackCast in the first five minutes. Every setup step must say what to do, where, and what "done" looks like.
- **Recover, don't blame.** Errors state the cause and the fix (e.g. "Port 8888 is already in use. Close the app using it and try again.").
- **Quiet when healthy.** No notifications or motion when everything works; surface state only when something needs attention.
- **Local and private.** No accounts, no telemetry. Credentials stay on the user's machine.

## Scope (v1.x)

In scope: setup wizard, Home (now playing), Settings, Help, tray, auto-start, auto-update, branded installer.

Out of scope for now: listening history/library, analytics, multi-platform builds, non-Spotify sources.

## Voice

English. Direct, friendly, short sentences. Name UI elements exactly as they appear in Spotify and OBS (e.g. **Redirect URIs**, **Tools → WebSocket Server Settings**).

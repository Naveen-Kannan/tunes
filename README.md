# Electron Tunes

A Spotify-inspired desktop music player for macOS that lets you search YouTube, download songs as MP3s, and organize them into playlists — all in a clean, modern UI.

![Electron](https://img.shields.io/badge/Electron-29-47848F?logo=electron&logoColor=white)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **YouTube Search & Download** — search YouTube and download any song as a high-quality MP3
- **Playlist Management** — create, rename, and delete playlists; organize your library your way
- **Full Playback Controls** — play/pause, skip, shuffle, repeat, volume, and progress scrubbing
- **Media Key Support** — play/pause and skip with your keyboard's media keys
- **iPhone Web Player** — stream your library to Safari over Tailscale with no native app
- **Queue** — view and manage your upcoming tracks
- **Glassmorphism UI** — dark theme with blurred glass-style panels and a hidden auto-reveal sidebar

## Prerequisites

- **macOS** (Apple Silicon / arm64)
- **Node.js** and **npm**
- **yt-dlp** — for YouTube downloading

  ```bash
  brew install yt-dlp
  ```

  Keep it current with `brew upgrade yt-dlp`; YouTube extractor changes can cause HTTP 403 errors.

- **Deno** — for yt-dlp's YouTube JavaScript challenges

  ```bash
  brew install deno
  ```

- **ffmpeg** — for audio encoding

  ```bash
  brew install ffmpeg
  ```

## Running Locally

```bash
npm install
npm start
```

## Building & Installing to /Applications

Build the macOS app bundle:

```bash
npm run pack
```

Then replace the installed app:

```bash
rm -rf "/Applications/Electron Tunes.app"
cp -R "dist/mac-arm64/Electron Tunes.app" /Applications/
```

After running, the app is launchable from Spotlight or your Applications folder.

Packaging nuance:
- `main.js` requires files under `src/`, so Electron packaging must include `src/**/*` in `package.json`.
- The local playback control endpoint used by `hotkey` listens on `127.0.0.1:47631`, so the macOS entitlements must include both `com.apple.security.network.client` and `com.apple.security.network.server` for packaged builds.

Playback control:
- The app exposes a small localhost-only control surface for `POST /control/play_pause`, `POST /control/next`, and `POST /control/previous`.
- `launcher` uses that path so Tunes playback can be controlled without bringing the app to the foreground.

iPhone web player:
- The app serves a phone-first web player at `http://<mac-tailscale-ip>:47632/mobile`.
- The mobile server binds to the Mac's Tailscale IPv4 address when one is available, and falls back to `127.0.0.1` if Tailscale is not detected.
- No separate iOS app or token entry is required; Tailscale provides the private network path.
- The player supports playlists, search, play/pause, next/previous, seeking, shuffle, and repeat modes.

## Project Structure

```
electron-tunes/
├── main.js               # Electron main process
├── preload.js            # IPC bridge (context isolation)
├── renderer.js           # Frontend logic
├── index.html            # App UI template
├── styles.css            # Styling
├── build_install.sh      # Build & install script
├── entitlements.mac.plist
└── src/
    ├── ipc/
    │   └── handlers.js   # IPC event handlers
    ├── mobile/           # Tailscale-served iPhone web player
    ├── services/
    │   ├── downloader.js # YouTube → MP3 download logic
    │   ├── search.js     # YouTube search
    │   └── store.js      # Playlist persistence
    └── utils/
        └── paths.js      # Path management
```

## Data Storage

Downloaded songs and playlists are stored locally in `~/Music/ElectronTunes/` — not in the project directory. Nothing is uploaded anywhere.

## License

MIT

### Dictation playback control

Flow uses `POST /control/dictation/begin?token=<uuid>` and
`POST /control/dictation/end?token=<uuid>`. The begin response acknowledges that the
renderer paused audio, so recording starts afterward. End resumes only music that was
playing before the recording, on the same track, and only after the last session ends.
Repeated requests are harmless. Manual playback/track changes override restoration;
Flow renews active sessions every minute; abandoned sessions expire after ten minutes. `GET /control/state` reports paused state
and playback position for diagnostics. These endpoints stay on `127.0.0.1:47631`.

Run playback lifecycle regression checks with `node --test tests/dictation.test.js`.

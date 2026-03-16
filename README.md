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
- **Queue** — view and manage your upcoming tracks
- **Glassmorphism UI** — dark theme with blurred glass-style panels and a hidden auto-reveal sidebar

## Prerequisites

- **macOS** (Apple Silicon / arm64)
- **Node.js** and **npm**
- **yt-dlp** — for YouTube downloading

  ```bash
  brew install yt-dlp
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

A convenience script handles building and installing the app to your Mac:

```bash
./build_install.sh
```

This will:
1. Build the macOS app via `electron-builder`
2. Remove any existing `/Applications/Electron Tunes.app`
3. Copy the freshly built app into `/Applications`

After running, the app is launchable from Spotlight or your Applications folder.

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

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
- **Library UI** — a dark interface with green playback indicators, collapsible playlist sidebar, title/artist filtering and song counts
- **Quick Actions** — add songs to the queue directly from a row, open song options with the ⋯ button, and click the current song to find it in the library
- **Remembered Controls** — volume, mute restore level, shuffle, repeat, and sidebar preferences survive relaunches

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

### Desktop polish (October 2026)

Tunes is designed for quick access to a private, local music library. The desktop
refresh preserves the existing download, mobile-player, media-key, and Flow control
paths. `Library` pins or collapses playlists; collapsed playlists still reveal on
hover at the left edge. The keyboard icon lists shortcuts: Cmd+F filters the library,
Cmd+K searches YouTube, Q opens the queue, and Shift+Left/Right seeks ten seconds.
Space, Left/Right, M, S, and R retain playback shortcuts. Native input controls and
open dialogs keep their keyboard behavior; Escape closes any dialog or clears a filter.

Filtering only changes the visible library, so an existing playback sequence can
continue. Songs stay in playlist order. The header Play button starts at the first
visible song.
Repeat One repeats when a song ends; manually choosing Next still advances.
Volume and seek controls support dragging and keyboard input. Local file URLs encode
spaces, Unicode, and punctuation so filenames containing # or ? remain playable.

UI preferences live in renderer localStorage (`tunes.preferences`). Audio does not
autoplay on launch. The app bundle's identifier and music storage directory stay
unchanged. Run `node --test tests/*.test.js` for library and Flow lifecycle checks.

When updating while music is playing, stage and verify the new bundle first. Preserve
the old bundle by renaming it into a backup, then rename the staged bundle into the
installed path; do not quit or reload the running app. The refreshed UI loads after
the user's next normal relaunch. Keep the old bundle until that relaunch is verified.

The desktop uses neutral surfaces, compact headings, and direct labels. Decorative
branding, placeholder artwork, gradients, and promotional empty-state copy are omitted.

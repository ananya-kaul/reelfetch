<p align="center"><img src="https://raw.githubusercontent.com/ananya-kaul/reelfetch/main/assets/reelfetch-logo.png" width="160" alt="Reelfetch logo"></p>
<h1 align="center">Reelfetch</h1>
<p align="center"><strong>Video. Audio. One command.</strong><br>A friendly command line companion for yt-dlp, by Ananya Kaul.</p>

Download video and audio from YouTube and other sites supported by [yt-dlp](https://github.com/yt-dlp/yt-dlp). Choose a quality, extract audio, save subtitles and thumbnails, or work through a list of URLs.

## Install

Requires **Node.js 22+**. Until the npm release is published, install directly from this repository:

```sh
npm install -g github:ananya-kaul/reelfetch
reelfetch setup
reelfetch doctor
```

`setup` requires **Python 3.10+** with `venv` and installs `yt-dlp[default]` into a private environment in your user data directory. Run it again to update yt-dlp when a site changes. There are no install hooks and no npm runtime dependencies. You can also use an existing `yt-dlp` executable on PATH without running setup.

Install **ffmpeg** and **ffprobe** for audio conversion, video/audio merging, and embedding metadata:

| System | Command |
| --- | --- |
| macOS | `brew install ffmpeg` |
| Windows | `winget install Gyan.FFmpeg` |
| Ubuntu / Debian | `sudo apt install ffmpeg python3-venv` |

See [FFmpeg's download page](https://ffmpeg.org/download.html) for other systems. Open a new terminal after installing tools on Windows.

After the npm release is available, the registry installation command will be `npm install -g reelfetch`.

## Quick start

```sh
# Best available video; quote URLs to protect query strings from your shell
reelfetch "https://www.youtube.com/watch?v=VIDEO_ID"

# Up to 1080p, saved to a chosen folder
reelfetch "https://example.com/video" --quality 1080 --output ./videos

# Extract high quality MP3 audio
reelfetch audio "https://example.com/video" --format mp3 --output ./music

# Save subtitles and cover image beside the download
reelfetch "https://example.com/video" --subs en --thumbnail

# First ten playlist entries; remember completed downloads
reelfetch "https://example.com/playlist" --playlist --limit 10 --archive history.txt

# Process one URL per line, ignoring blank lines and # comments
reelfetch video --batch urls.txt --rate 2M

# Inspect before downloading
reelfetch formats "https://example.com/video"
reelfetch info "https://example.com/video"
reelfetch "https://example.com/video" --dry-run
```

Replace example URLs with real media URLs. Reelfetch streams yt-dlp progress and errors into your terminal. Ctrl+C stops the process; running the same command can resume partial downloads when supported by the server. Existing media files are not overwritten.

## Commands and options

Run `reelfetch --help` for the complete reference.

| Command | What it does |
| --- | --- |
| `reelfetch <url>` / `reelfetch video <url>` | Download video at the best available quality |
| `reelfetch audio <url>` | Extract audio (MP3 by default) |
| `reelfetch info <url>` | Print metadata JSON; no media downloaded |
| `reelfetch formats <url>` | List available streams and formats |
| `reelfetch setup` | Install or update the downloader backend |
| `reelfetch doctor` | Report missing dependencies; exit 1 if any are missing |

| Option | Effect |
| --- | --- |
| `-o, --output DIR` | Destination folder; defaults to the current directory |
| `-q, --quality HEIGHT` | Maximum video height, e.g. 720, 1080, 2160, or best |
| `-f, --format FORMAT` | Audio output: mp3, m4a, opus, flac, wav, aac, best |
| `-p, --playlist` | Opt into full playlist downloads |
| `--limit N` | Only consider the first N playlist entries |
| `-b, --batch FILE` | Read a UTF-8 file of URLs |
| `--subs LANGS` | Write available manual/automatic subtitles, e.g. en,fr |
| `--thumbnail` | Save the source thumbnail; this does not embed cover art |
| `--metadata` | Embed media metadata with ffmpeg |
| `--archive FILE` | Record completed downloads to avoid downloading again |
| `--rate SPEED` | Limit transfer speed, e.g. 500K or 2M |
| `--dry-run` | Show the yt-dlp argument array without running it |

Quality is a ceiling, not an upscale. The best video's container is chosen by the available streams; MP4 is not guaranteed. `--format` controls audio extraction only. Missing subtitles or thumbnails depend on the source. Playlists are disabled by default; a URL to a playlist can still resolve to entries according to the source extractor's behavior.

## JavaScript API

```js
import { download, buildArgs } from 'reelfetch';

await download('https://example.com/video', {
  command: 'audio', format: 'mp3', output: './music',
});

const controller = new AbortController();
await download(['https://example.com/video'], {
  quality: '720', signal: controller.signal,
});

// Inspect metadata as a string for a single URL
const { stdout } = await download('https://example.com/video', {
  command: 'info', capture: true,
});
const metadata = JSON.parse(stdout);

// Build arguments without running a process
console.log(buildArgs('video', ['https://example.com/video'], { quality: '720' }));
```

The API rejects when the backend fails or a signal cancels the process. The default streams output directly to your terminal; `capture: true` buffers output, so reserve it for small inspection results. Multiple `info` URLs produce one JSON object per line. Source metadata can contain temporary stream URLs; avoid publishing raw results.

## Configuration and troubleshooting

Reelfetch passes `--ignore-config` to yt-dlp for predictable behavior. It uses the first matching backend: `REELFETCH_YTDLP`, its managed Python environment, then `yt-dlp` on PATH. The executable override is a path, not a shell command.

- `REELFETCH_HOME`: override the private environment directory.
- `REELFETCH_PYTHON`: Python executable used to create the environment.
- `REELFETCH_YTDLP`: path to an existing yt-dlp executable.

The default environment directory is `$XDG_DATA_HOME/reelfetch` or `~/.local/share/reelfetch` on Unix, and `%LOCALAPPDATA%\Reelfetch` on Windows. Delete that folder to remove the managed backend; `npm uninstall -g reelfetch` removes the CLI.

**YouTube extraction issues:** run `reelfetch setup` to update the backend and its JavaScript challenge support. Reelfetch enables Node.js as yt-dlp's JavaScript runtime. Sites may still impose login, region, network, or anti-bot restrictions. Login/cookie management is not included in this first release.

**Missing Python or venv:** install Python 3.10+ first. Debian-based systems may require `python3-venv`. **Missing ffmpeg:** use the installation commands above. **Format unavailable:** inspect `reelfetch formats URL`, or choose another quality.

Site support is provided by yt-dlp and can change. Reelfetch does not promise access to every video or website, bypass DRM, or download subscription media without authorization. Use it for media you own or have permission to download, following applicable site terms.

## Development

```sh
npm ci
npm test
npm run check
node bin/reelfetch.js --help
npm run test:integration # requires yt-dlp and ffmpeg; uses a generated local video
npm pack --dry-run
```

CI runs on macOS, Windows, and Linux with Node 22 and 24. Tests cover URL validation, option handling, batch parsing, process failures, and cancellation. Real downloads depend on external services and are checked separately.

## Credits and license

Created by **Ananya Kaul**. Reelfetch's code is MIT licensed. The original Reelfetch logo is included in `assets/reelfetch-logo.png`.

Reelfetch is an independent CLI built on [yt-dlp](https://github.com/yt-dlp/yt-dlp), with optional media processing by [FFmpeg](https://ffmpeg.org). Those projects retain their own licenses and attribution. Their executables are not bundled in this npm package.

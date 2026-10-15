#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { buildArgs, download, VERSION } from '../src/index.js';
import { diagnostics, setup } from '../src/runtime.js';

const help = `
  REELFETCH  /  Video. Audio. One command.

  Usage
    reelfetch <url> [options]
    reelfetch video <url> [options]
    reelfetch audio <url> [options]
    reelfetch info <url>             Print metadata as JSON
    reelfetch formats <url>          List available formats
    reelfetch setup                  Install/update yt-dlp in a private Python env
    reelfetch doctor                 Check download dependencies

  Options
    -o, --output <directory>         Download directory (default: current folder)
    -q, --quality <height|best>      Maximum video height (default: best)
    -f, --format <format>            Audio: mp3, m4a, opus, flac, wav, aac, best
    -p, --playlist                   Download the full playlist (default: one item)
        --limit <count>              Maximum playlist entries
    -b, --batch <file>               Read URLs from a text file, one per line
        --subs <languages>           Save subtitles, e.g. en or en,fr
        --thumbnail                  Save the thumbnail beside the media
        --metadata                   Embed media metadata (requires ffmpeg)
        --archive <file>             Remember downloads and skip them next time
        --rate <speed>               Download limit, e.g. 500K or 2M
        --dry-run                    Print argument array without downloading
    -h, --help                       Show help
    -v, --version                    Show version

  Examples
    reelfetch "https://www.youtube.com/watch?v=VIDEO_ID" -q 1080
    reelfetch audio "https://example.com/video" -f mp3 -o ./music
    reelfetch video --batch urls.txt --archive downloaded.txt

  Requirements: Node.js 22+, yt-dlp; ffmpeg for audio conversion and video merging.
  Run setup with Python 3.10+ installed. Download only media you have permission to save.
`;

const abort = new AbortController();
const stop = () => abort.abort();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: true, options: {
    output: { type: 'string', short: 'o' }, quality: { type: 'string', short: 'q' },
    format: { type: 'string', short: 'f' }, playlist: { type: 'boolean', short: 'p' },
    limit: { type: 'string' }, batch: { type: 'string', short: 'b' },
    subs: { type: 'string' }, thumbnail: { type: 'boolean' }, metadata: { type: 'boolean' },
    archive: { type: 'string' }, rate: { type: 'string' }, 'dry-run': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
  }});
  if (values.version) console.log(VERSION);
  else if (values.help || (!positionals.length && !values.batch)) console.log(help);
  else {
    let command = 'video';
    if (positionals[0] && !/^https?:\/\//i.test(positionals[0])) command = positionals.shift();
    if (['doctor', 'setup'].includes(command)) {
      if (positionals.length || Object.keys(values).length) throw new Error(`${command} does not accept URLs or options.`);
      if (command === 'setup') {
        console.log('Installing yt-dlp into Reelfetch’s private Python environment…');
        await setup({ signal: abort.signal });
        console.log('Downloader ready. Run reelfetch doctor to check ffmpeg.');
      } else {
        console.log(`Reelfetch ${VERSION} · Node ${process.version}\n`);
        const checks = await diagnostics();
        for (const check of checks) console.log(`${check.available ? '✓' : '✗'} ${check.name}: ${check.version ?? 'not installed'}`);
        if (checks.some(check => !check.available)) {
          console.log('\nInstall yt-dlp: reelfetch setup (requires Python 3.10+)\nInstall ffmpeg: https://ffmpeg.org/download.html\nmacOS: brew install ffmpeg\nWindows: winget install Gyan.FFmpeg\nUbuntu/Debian: sudo apt install ffmpeg');
          process.exitCode = 1;
        }
      }
    } else {
      if (values.batch) {
        const lines = (await readFile(values.batch, 'utf8')).split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
        positionals.push(...lines);
      }
      if (values['dry-run']) console.log(JSON.stringify(buildArgs(command, positionals, values), null, 2));
      else await download(positionals, { command, ...values, signal: abort.signal });
    }
  }
} catch (error) {
  if (abort.signal.aborted) { console.error('\nDownload interrupted. Run the command again to resume supported downloads.'); process.exitCode = 130; }
  else { console.error(`reelfetch: ${error.message}`); process.exitCode = 1; }
} finally {
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}

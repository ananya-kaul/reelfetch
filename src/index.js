import path from 'node:path';
import { engine, run } from './runtime.js';

export const VERSION = '0.1.1';
export const AUDIO_FORMATS = ['mp3', 'm4a', 'opus', 'flac', 'wav', 'aac', 'best'];
export const COMMANDS = ['video', 'audio', 'info', 'formats'];

export function validateUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`Invalid URL: ${value}. Use a full http:// or https:// URL.`); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('Only HTTP(S) URLs without embedded credentials are supported.');
  }
  return value;
}

export function buildArgs(command, urls, options = {}) {
  if (!COMMANDS.includes(command)) throw new Error(`Unknown command: ${command}`);
  if (!Array.isArray(urls) || urls.length === 0) throw new Error('Provide at least one URL, or use --batch FILE.');
  urls.forEach(validateUrl);
  const quality = String(options.quality ?? 'best');
  if (!/^(best|[1-9]\d{1,3})$/.test(quality)) throw new Error('--quality must be best or a height such as 720, 1080, or 2160.');
  const format = options.format ?? 'mp3';
  if (!AUDIO_FORMATS.includes(format)) throw new Error(`--format must be one of: ${AUDIO_FORMATS.join(', ')}.`);
  if (options.limit && !/^[1-9]\d*$/.test(String(options.limit))) throw new Error('--limit must be a positive integer.');
  if (options.rate && !/^\d+(\.\d+)?[KMG]?$/i.test(options.rate)) throw new Error('--rate must be a speed such as 500K or 2M.');
  if (options.subs && !/^[\w.*,\-]+$/.test(options.subs)) throw new Error('--subs must be language codes such as en or en,fr.');
  const args = ['--ignore-config', '--no-update', '--js-runtimes', 'node', '--windows-filenames', options.playlist ? '--yes-playlist' : '--no-playlist'];
  if (options.limit) args.push('--playlist-end', String(options.limit));
  if (command === 'info') return [...args, '--dump-single-json', '--skip-download', '--', ...urls];
  if (command === 'formats') return [...args, '--list-formats', '--', ...urls];
  args.push('--newline', '--continue', '--no-overwrites', '--paths', path.resolve(options.output ?? process.cwd()), '--output', '%(title).180B [%(id)s].%(ext)s');
  if (command === 'audio') args.push('--format', 'bestaudio/best', '--extract-audio', '--audio-format', format, '--audio-quality', '0');
  else args.push('--format', quality === 'best' ? 'bv*+ba/b' : `bv*[height<=${quality}]+ba/b[height<=${quality}]`);
  if (options.subs) args.push('--write-subs', '--write-auto-subs', '--sub-langs', options.subs);
  if (options.thumbnail) args.push('--write-thumbnail');
  if (options.metadata) args.push('--embed-metadata');
  if (options.archive) args.push('--download-archive', path.resolve(options.archive));
  if (options.rate) args.push('--limit-rate', options.rate);
  return [...args, '--', ...urls];
}

/** Run a download or inspection with yt-dlp. Output streams to the terminal by default. */
export async function download(urls, { command = 'video', signal, capture = false, ...options } = {}) {
  const args = buildArgs(command, typeof urls === 'string' ? [urls] : urls, options);
  const backend = await engine();
  return run(backend.command, [...backend.prefix, ...args], { signal, capture });
}

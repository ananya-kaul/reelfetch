import { spawn } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export function dataDirectory() {
  if (process.env.REELFETCH_HOME) return path.resolve(process.env.REELFETCH_HOME);
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || homedir(), 'Reelfetch');
  return path.join(process.env.XDG_DATA_HOME || path.join(homedir(), '.local', 'share'), 'reelfetch');
}

export function managedPython() {
  return path.join(dataDirectory(), 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
}

export async function engine() {
  if (process.env.REELFETCH_YTDLP) return { command: process.env.REELFETCH_YTDLP, prefix: [] };
  try {
    await access(managedPython());
    return { command: managedPython(), prefix: ['-m', 'yt_dlp'] };
  } catch {
    return { command: 'yt-dlp', prefix: [] };
  }
}

export function run(command, args, { capture = false, signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', signal });
    let stdout = '';
    let stderr = '';
    if (capture) {
      child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
      child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    }
    child.once('error', error => {
      if (error.code === 'ENOENT') reject(new Error(`Cannot find ${command}. Run "reelfetch setup" for the downloader, or "reelfetch doctor" for dependency guidance.`));
      else reject(error);
    });
    child.once('close', (code, childSignal) => {
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(`${path.basename(command)} ${childSignal ? `stopped (${childSignal})` : `exited with code ${code}`}${stderr.trim() ? `: ${stderr.trim()}` : ''}.`));
    });
  });
}

export async function setup({ signal } = {}) {
  const python = process.env.REELFETCH_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  await mkdir(dataDirectory(), { recursive: true });
  try { await access(managedPython()); }
  catch { await run(python, ['-m', 'venv', path.join(dataDirectory(), 'venv')], { signal }); }
  await run(managedPython(), ['-m', 'pip', 'install', '--upgrade', 'yt-dlp[default]'], { signal });
}

export async function diagnostics() {
  const backend = await engine();
  const commands = [
    ['yt-dlp', backend.command, [...backend.prefix, '--version']],
    ['ffmpeg', 'ffmpeg', ['-version']],
    ['ffprobe', 'ffprobe', ['-version']],
  ];
  return Promise.all(commands.map(async ([name, command, args]) => {
    try { const { stdout } = await run(command, args, { capture: true }); return { name, available: true, version: stdout.split('\n')[0] }; }
    catch { return { name, available: false, version: null }; }
  }));
}

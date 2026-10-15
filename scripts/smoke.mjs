// Optional integration check: requires the real yt-dlp, ffmpeg, and ffprobe.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdtemp, readdir, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../src/runtime.js';

const dir = await mkdtemp(path.join(tmpdir(), 'reelfetch-smoke-'));
const source = path.join(dir, 'sample.mp4');
const cli = process.argv[2] || fileURLToPath(new URL('../bin/reelfetch.js', import.meta.url));
let server;
try {
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=teal:s=320x240:d=1', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:v', 'mpeg4', '-c:a', 'aac', '-shortest', source], { capture: true });
  const size = (await stat(source)).size;
  server = createServer((req, res) => {
    if (req.url !== '/sample.mp4') { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': size });
    if (req.method === 'HEAD') res.end();
    else createReadStream(source).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/sample.mp4`;
  const invoke = args => run(process.execPath, [cli, ...args], { capture: true });
  const metadata = JSON.parse((await invoke(['info', url])).stdout);
  assert.equal(metadata.ext, 'mp4');
  await invoke(['formats', url]);
  const videos = path.join(dir, 'video output');
  const archive = path.join(dir, 'history.txt');
  await invoke([url, '-o', videos, '--archive', archive]);
  const video = (await readdir(videos)).find(file => file.endsWith('.mp4'));
  assert.ok(video, 'MP4 was downloaded');
  assert.equal((await stat(path.join(videos, video))).size, size);
  const repeated = await invoke([url, '-o', videos, '--archive', archive]);
  assert.match(repeated.stdout, /already been recorded in the archive/);
  const audioDir = path.join(dir, 'audio');
  await invoke(['audio', url, '-f', 'mp3', '-o', audioDir, '--metadata']);
  const mp3 = (await readdir(audioDir)).find(file => file.endsWith('.mp3'));
  assert.ok(mp3, 'MP3 was extracted');
  const probe = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name', '-of', 'json', path.join(audioDir, mp3)], { capture: true });
  assert.equal(JSON.parse(probe.stdout).streams[0].codec_name, 'mp3');
  console.log('PASS: metadata, formats, HTTP video download, archive deduplication, and MP3 extraction using real tools.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
}

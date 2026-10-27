import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArgs, validateUrl } from '../src/index.js';
import { run } from '../src/runtime.js';
const cli = fileURLToPath(new URL('../bin/reelfetch.js', import.meta.url));
const url = 'https://example.com/video.mp4';
const invoke = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

test('untrusted URL query characters stay in a single positional argument', () => {
  const input = 'https://example.com/video?a=$(echo%20oops)&b=1';
  const args = buildArgs('video', [input]);
  assert.deepEqual(args.slice(-2), ['--', input]);
  assert.ok(args.includes('--ignore-config'));
});
test('reject local files, credentials, option injection, and malformed URLs', () => {
  for (const input of ['file:///etc/passwd', '--exec=touch', 'not a url', 'https://user:secret@example.com']) assert.throws(() => validateUrl(input));
});
test('quality cap applies to both separate streams and combined fallback', () => {
  const args = buildArgs('video', [url], { quality: '720' });
  assert.equal(args[args.indexOf('--format') + 1], 'bv*[height<=720]+ba/b[height<=720]');
});
test('audio extraction supports explicit codec and preserves output paths with spaces', () => {
  const args = buildArgs('audio', [url], { format: 'flac', output: './my music' });
  assert.ok(args.includes('--extract-audio'));
  assert.equal(args[args.indexOf('--audio-format') + 1], 'flac');
  assert.equal(args[args.indexOf('--paths') + 1], path.resolve('my music'));
});
test('playlist requires opt-in, with optional bounded entry count', () => {
  assert.ok(buildArgs('video', [url]).includes('--no-playlist'));
  const args = buildArgs('video', [url], { playlist: true, limit: '3' });
  assert.ok(args.includes('--yes-playlist'));
  assert.equal(args[args.indexOf('--playlist-end') + 1], '3');
});
test('explicit invalid playlist limits are rejected instead of ignored', () => {
  for (const limit of [0, '0', false, '', NaN, -1, 1.5]) {
    assert.throws(() => buildArgs('video', [url], { playlist: true, limit }), /--limit must be a positive integer/);
  }
  for (const limit of [undefined, null]) {
    assert.ok(!buildArgs('video', [url], { limit }).includes('--playlist-end'));
  }
  for (const limit of [1, '3']) {
    const args = buildArgs('video', [url], { limit });
    assert.equal(args[args.indexOf('--playlist-end') + 1], String(limit));
  }
});
test('invalid options fail before launching a process', () => {
  for (const options of [{ quality: '720;exit' }, { format: 'exe' }, { limit: '-1' }, { rate: 'fast' }, { subs: '../en' }]) {
    assert.throws(() => buildArgs('video', [url], options));
  }
});
test('metadata inspection never initiates a media download', () => {
  const args = buildArgs('info', [url]);
  assert.ok(args.includes('--skip-download'));
  assert.ok(args.includes('--dump-single-json'));
  assert.ok(!args.includes('--extract-audio'));
});
test('CLI accepts URLs without a subcommand and reports bad flags', () => {
  const result = invoke([url, '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).at(-1), url);
  assert.equal(invoke([url, '--quailty', '720']).status, 1);
  assert.equal(invoke(['video']).status, 1);
  assert.equal(invoke(['unknown']).status, 1);
});
test('batch file ignores blank lines and comments and validates every URL', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'reelfetch-test-'));
  try {
    const file = path.join(dir, 'urls.txt');
    await writeFile(file, `# sources\r\n\r\n${url}\r\nhttps://example.com/second.mp4\n`);
    const result = invoke(['--batch', file, '--dry-run']);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).slice(-2), [url, 'https://example.com/second.mp4']);
    await writeFile(file, `${url}\nfile:///etc/passwd`);
    assert.equal(invoke(['--batch', file, '--dry-run']).status, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('process failures and missing executables are surfaced', async () => {
  await assert.rejects(run(process.execPath, ['-e', 'process.exit(7)'], { capture: true }), /code 7/);
  await assert.rejects(run('reelfetch-nonexistent-executable-xyz', [], { capture: true }), /Cannot find/);
});
test('cancellation stops the downloader process', async () => {
  const controller = new AbortController();
  const pending = run(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { capture: true, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

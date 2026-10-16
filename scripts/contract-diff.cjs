const { execFileSync, spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');

const OASDIFF_VERSION = '1.11.7';
const ROOT = resolve(__dirname, '..');
const TOOL_DIR = join(ROOT, 'tools', 'oasdiff');
const BINARY = join(TOOL_DIR, process.platform === 'win32' ? 'oasdiff.exe' : 'oasdiff');

function platformAsset() {
  const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch];
  const platform = { win32: 'windows', linux: 'linux', darwin: 'darwin' }[
    process.platform
  ];
  if (!arch || !platform) {
    throw new Error(`Unsupported platform ${process.platform}/${process.arch}`);
  }
  return `oasdiff_${OASDIFF_VERSION}_${platform}_${platform === 'darwin' ? 'all' : arch}.tar.gz`;
}

function ensureBinary() {
  mkdirSync(TOOL_DIR, { recursive: true });
  const asset = platformAsset();
  const url = `https://github.com/oasdiff/oasdiff/releases/download/v${OASDIFF_VERSION}/${asset}`;
  const archive = join(TOOL_DIR, asset);
  if (!existsSync(archive)) {
    console.log(`Downloading pinned oasdiff v${OASDIFF_VERSION}…`);
    execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--max-time', '120', '-o', archive, url], { stdio: 'inherit' });
  }
  const checksums = readFileSync(join(__dirname, `oasdiff-${OASDIFF_VERSION}-checksums.txt`), 'utf8');
  const expected = checksums.split(/\r?\n/).map(line => line.trim().split(/\s+/)).find(([, name]) => name === asset)?.[0];
  const actual = createHash('sha256').update(readFileSync(archive)).digest('hex');
  if (!expected || actual !== expected) throw new Error('oasdiff archive checksum mismatch; refusing execution.');
  execFileSync('tar', ['-xzf', archive, '-C', TOOL_DIR], { stdio: 'inherit' });
  execFileSync(BINARY, ['--version'], { stdio: 'inherit' });
}

function resolveBase(baseArg) {
  if (baseArg && baseArg !== 'HEAD') return resolve(baseArg);
  const content = execFileSync(
    'git',
    ['show', 'HEAD:docs/contracts/openapi.json'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const temp = join(os.tmpdir(), `openapi-base-${process.pid}.json`);
  writeFileSync(temp, content);
  return temp;
}

function main() {
  const [baseArg, revisionArg] = process.argv.slice(2);
  ensureBinary();
  let base;
  try {
    base = resolveBase(baseArg);
  } catch {
    throw new Error('No baseline available. Supply an explicit reviewed contract file; comparison was not performed.');
  }
  const revision = resolve(revisionArg ?? join(ROOT, 'docs/contracts/openapi.json'));
  console.log(`Comparing baseline ${baseArg ?? 'HEAD'} -> ${revision}`);
  const result = spawnSync(
    BINARY,
    ['breaking', base, revision, '--fail-on', 'ERR'],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    console.error(
      'Breaking change detected. A deliberate exception needs a migration plan (affected consumers + compatibility window) recorded in docs/integration/execution-checkpoint.md.',
    );
    process.exit(result.status ?? 1);
  }
  console.log('No unplanned breaking changes.');
}

main();

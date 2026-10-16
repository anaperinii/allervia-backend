const { spawn } = require('node:child_process');
const { readFileSync, mkdirSync, createWriteStream } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '../..');
const web = resolve(root, '../allervia-web');
const { assertDemoDatabase } = require('../demo-environment.cjs');
const dotenv = require('dotenv');
const demo = dotenv.parse(readFileSync(resolve(root, '.env.demo.local')));
assertDemoDatabase(demo);
const env = { ...process.env, ...demo, NODE_ENV: 'development', PORT: '3119',
  AUTH_ALLOWED_ORIGINS: 'http://localhost:5179', AUTH_INSECURE_COOKIES: 'true',
  EMAIL_TRANSPORT: 'log', ALLERVIA_DISPATCHERS_DISABLED: 'true',
  // Browser regression repeats share synthetic data; abuse boundaries have
  // their own dedicated integration tests with explicit small limits.
  RATE_LIMIT_EXPORT_MAX: '1000',
  GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '', SMTP_HOST: '', SMTP_PASSWORD: '',
};
mkdirSync(resolve(root, 'artifacts'), { recursive: true });
const processes = [];
function start(args, cwd, childEnv, logName) {
  const child = spawn(process.execPath, args, { cwd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = createWriteStream(resolve(root, 'artifacts', logName));
  child.stdout.pipe(log); child.stderr.pipe(log);
  processes.push(child);
  return child;
}
async function wait(url) {
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Local validation server did not become ready.');
}
async function main() {
  // Do not accidentally validate another process already using our ports.
  const net = require('node:net');
  for (const port of [3119, 5179]) await new Promise((ok, fail) => {
    const server = net.createServer(); server.once('error', fail);
    server.listen(port, () => server.close(ok));
  });
  start(['dist/src/main.js'], root, env, 'local-api.log');
  await wait('http://localhost:3119/health/ready');
  console.log('Compiled Nest application ready on dedicated port 3119.');
  start(['node_modules/vite/bin/vite.js', '--port', '5179', '--strictPort'], web,
    { ...process.env, VITE_API_PROXY_TARGET: 'http://localhost:3119' }, 'local-web.log');
  await wait('http://localhost:5179');
  const specs = process.argv.slice(2);
  const test = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--workers=1', '--grep-invert', 'repro amplified', ...specs], {
    cwd: web, stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_EXTERNAL_SERVER: 'true', PLAYWRIGHT_BASE_URL: 'http://localhost:5179' },
  });
  processes.push(test);
  const code = await new Promise((ok, fail) => { test.once('exit', ok); test.once('error', fail); });
  if (code !== 0) throw new Error(`Browser validation failed (${code}).`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => {
  for (const child of processes.reverse()) if (child.exitCode === null) child.kill('SIGTERM');
});

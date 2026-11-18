const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const DEMO_DATABASE_NAME_PATTERN = /(?:^|[_-])demo$/i;
const EXTERNAL_INTEGRATION_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
];

function describeTarget(url) {
  return `${url.hostname}:${url.port || '5432'}/${url.pathname.slice(1)}`;
}

function parseDatabaseUrl(value, label) {
  if (!value) {
    throw new Error(`${label} must define DATABASE_URL.`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} DATABASE_URL is not a valid URL.`);
  }
  return url;
}

function sameDatabase(a, b) {
  const isLocal = (host) => LOCAL_HOSTS.includes(host);
  const sameHost =
    a.hostname === b.hostname || (isLocal(a.hostname) && isLocal(b.hostname));
  return (
    sameHost &&
    (a.port || '5432') === (b.port || '5432') &&
    a.pathname === b.pathname
  );
}

function assertDemoDatabase(env, developmentUrl, testUrl) {
  if (env.NODE_ENV === 'production') {
    throw new Error('Demo environment must not declare NODE_ENV=production.');
  }
  const target = parseDatabaseUrl(env.DATABASE_URL, 'Demo environment');
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new Error('Demo database must use a postgres:// URL.');
  }
  if (!LOCAL_HOSTS.includes(target.hostname)) {
    throw new Error(
      `Demo database must be local; refusing remote host "${target.hostname}".`,
    );
  }
  const databaseName = target.pathname.slice(1);
  if (!DEMO_DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error(
      `Demo database name must end with "demo" (e.g. allervia_demo); got "${databaseName}".`,
    );
  }
  for (const [label, rawUrl] of [
    ['development', developmentUrl],
    ['test', testUrl],
  ]) {
    if (!rawUrl) continue;
    let other;
    try {
      other = new URL(rawUrl);
    } catch {
      continue;
    }
    if (sameDatabase(target, other)) {
      throw new Error(
        `Demo database must differ from the ${label} database (${describeTarget(other)}).`,
      );
    }
  }
  return target;
}

function loadDemoEnvironment() {
  const root = path.resolve(__dirname, '..');
  const demoPath = path.join(root, '.env.demo.local');
  if (!fs.existsSync(demoPath)) {
    throw new Error(
      'Missing .env.demo.local. Copy .env.demo.example, review every value and retry. ' +
        'The demo tooling never falls back to .env.',
    );
  }
  const demoEnv = dotenv.parse(fs.readFileSync(demoPath));
  const readOptional = (file) => {
    const fullPath = path.join(root, file);
    return fs.existsSync(fullPath)
      ? dotenv.parse(fs.readFileSync(fullPath))
      : {};
  };
  const developmentEnv = readOptional('.env');
  const testEnv = readOptional('.env.test.local');
  const target = assertDemoDatabase(
    demoEnv,
    developmentEnv.DATABASE_URL,
    testEnv.DATABASE_URL,
  );
  if (
    process.env.DATABASE_URL &&
    process.env.DATABASE_URL !== demoEnv.DATABASE_URL
  ) {
    throw new Error(
      'Inherited DATABASE_URL differs from .env.demo.local; refusing to continue.',
    );
  }
  for (const key of EXTERNAL_INTEGRATION_KEYS) {
    delete process.env[key];
    delete demoEnv[key];
  }
  Object.assign(process.env, demoEnv, {
    EMAIL_TRANSPORT: 'log',
    ALLERVIA_DISPATCHERS_DISABLED: 'true',
  });
  return { databaseLabel: describeTarget(target) };
}

module.exports = { assertDemoDatabase, loadDemoEnvironment };

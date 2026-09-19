const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

function assertTestDatabase(env, developmentUrl) {
  if (env.NODE_ENV !== 'test' || !env.DATABASE_URL) {
    throw new Error('Database tests require NODE_ENV=test and DATABASE_URL.');
  }
  const target = new URL(env.DATABASE_URL);
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !/(?:^test[_-]|[_-]test(?:[_-]|$)|[_-]dbtest$)/i.test(
      target.pathname.slice(1),
    )
  ) {
    throw new Error(
      'Database tests require a local, explicitly named test database.',
    );
  }
  if (developmentUrl) {
    const development = new URL(developmentUrl);
    // Treat loopback aliases as the same server; schema/user differences do not isolate data.
    const isLocal = (host) =>
      ['localhost', '127.0.0.1', '[::1]'].includes(host);
    const sameHost =
      target.hostname === development.hostname ||
      (isLocal(target.hostname) && isLocal(development.hostname));
    if (
      sameHost &&
      (target.port || '5432') === (development.port || '5432') &&
      target.pathname === development.pathname
    ) {
      throw new Error(
        'The test database must differ from the development database.',
      );
    }
  }
}

function loadTestEnvironment() {
  const root = path.resolve(__dirname, '../..');
  const testEnv = dotenv.parse(
    fs.readFileSync(path.join(root, '.env.test.local')),
  );
  const developmentPath = path.join(root, '.env');
  const developmentEnv = fs.existsSync(developmentPath)
    ? dotenv.parse(fs.readFileSync(developmentPath))
    : {};
  assertTestDatabase(testEnv, developmentEnv.DATABASE_URL);
  if (
    process.env.DATABASE_URL &&
    process.env.DATABASE_URL !== testEnv.DATABASE_URL
  ) {
    throw new Error('Inherited DATABASE_URL differs from .env.test.local.');
  }
  Object.assign(process.env, testEnv);
  // Test-only defaults prevent AppModule from inheriting application JWT credentials.
  process.env.JWT_SECRET = testEnv.JWT_SECRET || 'allervia-local-test-secret';
  process.env.JWT_EXPIRES_IN = testEnv.JWT_EXPIRES_IN || '1h';
}

module.exports = { assertTestDatabase, loadTestEnvironment };

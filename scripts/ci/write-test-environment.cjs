const { writeFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomBytes } = require('node:crypto');
const root = resolve(__dirname, '../..');
if (process.env.CI !== 'true') throw new Error('Only for ephemeral CI workspaces.');
for (const file of ['.env.test.local', '.env.demo.local']) {
  if (existsSync(resolve(root, file))) throw new Error(`Refusing to replace ${file}`);
}
const password = process.env.CI_DATABASE_PASSWORD;
if (!password || !/^[a-zA-Z0-9_-]+$/.test(password)) throw new Error('CI_DATABASE_PASSWORD must be URL-safe.');
const common = [
  `AUTH_SESSION_CSRF_SECRET=${randomBytes(32).toString('hex')}`,
  `SUPER_ADMIN_REGISTRATION_KEY=${randomBytes(32).toString('hex')}`,
  `MFA_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`,
  'AUTH_MFA_ENFORCEMENT=optional',
  'AUTH_INSECURE_COOKIES=true',
  'AUTH_ALLOWED_ORIGINS=http://localhost:5175',
  'APP_BASE_URL=http://localhost:5175',
  'EMAIL_TRANSPORT=log',
  'ALLERVIA_DISPATCHERS_DISABLED=true',
];
for (const [file, mode, database] of [
  ['.env.test.local', 'test', 'allervia_test'],
  ['.env.demo.local', 'development', 'allervia_demo'],
]) {
  writeFileSync(resolve(root, file), [`NODE_ENV=${mode}`, `DATABASE_URL=postgresql://postgres:${password}@localhost:5432/${database}`, ...common, ...(mode === 'development' ? ['RATE_LIMIT_EXPORT_MAX=1000'] : []), ''].join('\n'), { flag: 'wx', mode: 0o600 });
}
console.log('Ephemeral test and demo configurations created.');

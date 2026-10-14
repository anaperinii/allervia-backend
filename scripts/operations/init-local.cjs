const { randomBytes } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const output = resolve(__dirname, '../../.env.compose.local');
const contents = [
  `POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}`,
  `AUTH_SESSION_CSRF_SECRET=${randomBytes(32).toString('hex')}`,
  `MFA_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`,
  `SUPER_ADMIN_REGISTRATION_KEY=${randomBytes(32).toString('hex')}`,
  'ALLERVIA_WEB_PATH=../allervia-web',
  '',
].join('\n');
writeFileSync(output, contents, { flag: 'wx', mode: 0o600 });
console.log('Private local configuration created; no existing secrets overwritten.');

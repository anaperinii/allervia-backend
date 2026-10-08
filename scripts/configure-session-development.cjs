const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const dotenv = require('dotenv');
const file = '.env';
const env = dotenv.parse(fs.readFileSync(file, 'utf8'));
if (env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production')
  throw new Error('Use private secret management in production');
if (!env.AUTH_SESSION_CSRF_SECRET) {
  fs.appendFileSync(file, '\n# Opaque browser sessions\nAUTH_SESSION_CSRF_SECRET=' + randomBytes(32).toString('base64url') + '\n');
}
console.log('Local session configuration ready; no secrets printed.');

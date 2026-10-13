const { writeFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
// The existing loader retains all its localhost/demo/production protections.
writeFileSync('.env.demo.local', [
  'NODE_ENV=development',
  `DATABASE_URL=${process.env.DATABASE_URL}`,
  `AUTH_SESSION_CSRF_SECRET=${process.env.AUTH_SESSION_CSRF_SECRET}`,
  `SUPER_ADMIN_REGISTRATION_KEY=${process.env.SUPER_ADMIN_REGISTRATION_KEY}`,
  'EMAIL_TRANSPORT=log',
].join('\n'), { mode: 0o600 });
const result = spawnSync(process.execPath, ['node_modules/ts-node/dist/bin.js', '-T', '-r', 'tsconfig-paths/register', 'scripts/seed-demo-dataset.ts'], { stdio: 'inherit' });
process.exit(result.status ?? 1);

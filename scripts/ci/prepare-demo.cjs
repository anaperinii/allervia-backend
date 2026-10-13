const { spawnSync } = require('node:child_process');
require('../demo-environment.cjs').loadDemoEnvironment();
const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const seed = spawnSync(process.execPath, [require.resolve('ts-node/dist/bin.js'), '-T', '-r', 'tsconfig-paths/register', 'scripts/seed-demo-dataset.ts'], { stdio: 'inherit' });
process.exit(seed.status ?? 1);

import { spawnSync } from 'node:child_process';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadDemoEnvironment } = require('./demo-environment.cjs') as {
  loadDemoEnvironment: () => { databaseLabel: string };
};

const { databaseLabel } = loadDemoEnvironment();
console.log(`Recreating the dedicated demo database: ${databaseLabel}`);

const result = spawnSync(
  process.execPath,
  [
    require.resolve('prisma/build/index.js'),
    'migrate',
    'reset',
    '--force',
  ],
  { stdio: 'inherit', env: process.env },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log('Demo database recreated with all migrations applied.');

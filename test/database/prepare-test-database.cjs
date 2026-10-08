const { spawnSync } = require('node:child_process');
const { loadTestEnvironment } = require('./test-environment.cjs');

loadTestEnvironment();
const mode = process.argv[2];
if (!['deploy', 'reset'].includes(mode)) {
  throw new Error('Expected deploy or reset.');
}
const commands = [
  mode === 'reset' ? ['migrate', 'reset', '--force'] : ['migrate', 'deploy'],
  ['generate'],
];
for (const args of commands) {
  const result = spawnSync(
    process.execPath,
    [require.resolve('prisma/build/index.js'), ...args],
    {
      stdio: 'inherit',
      env: process.env,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

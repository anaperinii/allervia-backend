const { execFileSync } = require('node:child_process');
const { writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const sha = process.env.CONTRACT_BASE_SHA;
if (!sha || !/^[a-f0-9]{40}$/.test(sha) || /^0+$/.test(sha)) {
  throw new Error('A real CONTRACT_BASE_SHA is required for compatibility validation.');
}
const root = resolve(__dirname, '../..');
const content = execFileSync('git', ['show', `${sha}:docs/contracts/openapi.json`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
mkdirSync(resolve(root, 'artifacts'), { recursive: true });
const file = resolve(root, 'artifacts/contract-baseline.json');
writeFileSync(file, content);
execFileSync(process.execPath, [resolve(root, 'scripts/contract-diff.cjs'), file], { cwd: root, stdio: 'inherit' });

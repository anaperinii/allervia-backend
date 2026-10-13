const { execFileSync } = require('node:child_process');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const root = resolve(__dirname, '../..');
const web = resolve(process.env.ALLERVIA_WEB_ROOT || resolve(root, '../allervia-web'));
function git(cwd, args) { return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim(); }
function revision(cwd) {
  const diff = execFileSync('git', ['diff', 'HEAD', '--binary'], { cwd, maxBuffer: 64 * 1024 * 1024 });
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  const hash = createHash('sha256').update(diff);
  for (const file of untracked.sort()) hash.update(file).update(readFileSync(resolve(cwd, file)));
  return { sha: git(cwd, ['rev-parse', 'HEAD']), dirty: Boolean(git(cwd, ['status', '--porcelain'])), workingTreeDigest: hash.digest('hex') };
}
const record = {
  createdAt: new Date().toISOString(), scope: 'local-validation-only',
  backend: revision(root), frontend: revision(web),
  contractDigest: createHash('sha256').update(readFileSync(resolve(root, 'docs/contracts/openapi.json'))).digest('hex'),
  testResult: 'See execution report; this manifest does not certify tests or deployment.',
};
mkdirSync(resolve(root, 'artifacts'), { recursive: true });
writeFileSync(resolve(root, 'artifacts/validation-manifest.json'), JSON.stringify(record, null, 2));
console.log('Local revision manifest written without source contents or secrets.');

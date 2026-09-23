const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const temp = process.env.TEMP || process.env.TMPDIR || '/tmp';
const read = (name) => fs.readFileSync(path.join(temp, name), 'utf8');
const backendLint = JSON.parse(read('allervia-i0-backend-lint.json'));
const integrationLog = read('allervia-i0-integration.log');
const suiteMatch = integrationLog.match(/Test Suites:\s+(\d+) passed, (\d+) total/);
const testsMatch = integrationLog.match(/Tests:\s+(\d+) passed, (\d+) total/);
if (!suiteMatch || !testsMatch) throw new Error('Expected completed integration summary.');
const webLint = read('allervia-i0-web-lint.log');
const findings = backendLint.flatMap((item) => item.messages.map((message) => ({
  source: path.relative(root, item.filePath).replaceAll('\\', '/'),
  line: message.line, rule: message.ruleId, severity: message.severity,
  message: message.message,
})));
const grouped = {};
for (const finding of findings) {
  const key = finding.message === 'Delete `␍`' ? 'CRLF endings' : 'Other formatting';
  grouped[key] = (grouped[key] || 0) + 1;
}
const webMatch = webLint.match(/(\d+) problems \((\d+) errors, (\d+) warnings\)/);
if (!webMatch) throw new Error('Expected web lint baseline summary.');
const summary = {
  date: '2026-09-19',
  initialRevisions: { backend: 'caa700361eaffcaca4ebd9c371d88831dc20b789', web: '8a2b99a69deebe07dbb8f4c300e2a1ed74d19877' },
  initialBranches: { backend: 'homolog', web: 'homolog' },
  initialChanges: { backend: ['README.md modified', '.claude/, CLAUDE.md, LEGACY_ARCHITECTURE.md, docs/, graphify-out/, scripts/ untracked'], web: [] },
  workingBranches: { backend: 'refactor/integration-baseline', web: 'refactor/integration-baseline' },
  runtime: { node: process.version, npm: '11.2.0' },
  backendLint: { errors: backendLint.reduce((n, f) => n + f.errorCount, 0), warnings: backendLint.reduce((n, f) => n + f.warningCount, 0), grouped,
    files: backendLint.filter((f) => f.errorCount || f.warningCount).map((f) => ({ source: path.relative(root, f.filePath).replaceAll('\\', '/'), errors: f.errorCount, warnings: f.warningCount })) },
  webLint: { errors: Number(webMatch[2]), warnings: Number(webMatch[3]) },
  integration: { suites: Number(suiteMatch[1]), passed: Number(testsMatch[1]), total: Number(testsMatch[2]),
    suiteFiles: [...integrationLog.matchAll(/^PASS\s+([^\r\n]+?)(?: \([\d.]+ s\))?$/gm)].map((m) => m[1]) },
};
fs.writeFileSync(path.join(root, 'docs/integration-baseline/initial-results.json'), JSON.stringify(summary, null, 2) + '\n');
// Preserve useful lint evidence without machine-specific prefixes or ANSI escapes.
fs.writeFileSync(path.join(root, 'docs/integration-baseline/web-lint-baseline.txt'), webLint.replaceAll('C:\\allervia-web\\', '').replace(/\u001b\[[0-9;]*m/g, ''));
console.log(JSON.stringify({ backendLint: { errors: summary.backendLint.errors, grouped }, webLint: summary.webLint, integration: summary.integration.passed }));

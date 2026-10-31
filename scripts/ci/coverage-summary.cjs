const { readFileSync, appendFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '../..');
const summaryPath = resolve(root, 'coverage/coverage-summary.json');
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const total = summary.total;

const pct = (metric) => `${total[metric].pct.toFixed(2)}%`;
const frac = (metric) => `${total[metric].covered}/${total[metric].total}`;

const lines = [
  '## Cobertura de testes',
  '',
  '| Métrica | % | Cobertos/Total |',
  '| --- | --- | --- |',
  `| Linhas | ${pct('lines')} | ${frac('lines')} |`,
  `| Branches | ${pct('branches')} | ${frac('branches')} |`,
  `| Funções | ${pct('functions')} | ${frac('functions')} |`,
  `| Statements | ${pct('statements')} | ${frac('statements')} |`,
  '',
  '_Informativo — não bloqueia o PR. Relatório completo em `coverage/lcov-report/index.html` (artefato `coverage`)._',
  '',
].join('\n');

const target = process.env.GITHUB_STEP_SUMMARY;
if (target) {
  appendFileSync(target, lines);
} else {
  console.log(lines);
}

#!/usr/bin/env node
/**
 * Inventário de códigos de erro: catálogo × códigos lançados no código.
 * Detecta: throw new *Exception('CODIGO'), Coded*Exception('CODIGO', ...),
 * e bodies { code: 'CODIGO' }. Falha (exit 1) com --check se houver código
 * lançado fora do catálogo.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const CATALOG = path.join(SRC, 'infra', 'errors', 'error-catalog.ts');

const catalogText = fs.readFileSync(CATALOG, 'utf8');
const catalogCodes = new Set(
  [...catalogText.matchAll(/^\s*([A-Z][A-Z0-9_]+):\s*(?:'|")/gm)].map((m) => m[1]),
);

const CODE_RX = /^[A-Z][A-Z0-9_]{2,}$/;
const THROW_RX =
  /new\s+(\w*Exception)\(\s*(?:'([^']+)'|"([^"]+)")\s*[,)]/g;
const BODY_RX = /new\s+(\w*Exception)\(\s*\{[^}]*?code:\s*(?:'([^']+)'|"([^"]+)")/gs;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
      out.push(full);
  }
  return out;
}

const thrown = [];
for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  for (const rx of [THROW_RX, BODY_RX]) {
    let m;
    while ((m = rx.exec(text)) !== null) {
      const code = m[2] ?? m[3];
      if (code && CODE_RX.test(code)) {
        const line = text.slice(0, m.index).split('\n').length;
        thrown.push({ code, exception: m[1], file: rel, line });
      }
    }
  }
}

// Códigos emitidos via constantes (AUTH_ERROR_CODES): todos os valores do
// mapa contam como alcançáveis e precisam de entrada no catálogo.
const authMessages = fs.readFileSync(
  path.join(SRC, 'security', 'auth.messages.ts'),
  'utf8',
);
const authBlock = authMessages.split('AUTH_ERROR_CODES')[1] ?? '';
for (const m of authBlock.matchAll(/:\s*'([A-Z][A-Z0-9_]+)'/g)) {
  thrown.push({
    code: m[1],
    exception: 'AUTH_ERROR_CODES',
    file: 'src/security/auth.messages.ts',
    line: 0,
  });
}

const thrownCodes = new Set(thrown.map((t) => t.code));
const outsideCatalog = thrown.filter((t) => !catalogCodes.has(t.code));
const neverThrown = [...catalogCodes].filter((c) => !thrownCodes.has(c)).sort();

const report = {
  generatedAt: new Date().toISOString(),
  catalogSize: catalogCodes.size,
  distinctThrownCodes: thrownCodes.size,
  thrownOutsideCatalog: outsideCatalog,
  catalogCodesNeverThrownDirectly: neverThrown,
  note:
    'catalogCodesNeverThrownDirectly inclui códigos emitidos por caminhos dinâmicos ' +
    '(VALIDATION_ERROR do pipe, defaults do filtro, DomainException por nome, motor clínico UNRESOLVED); ' +
    'não é prova de código morto.',
  allThrown: thrown.sort((a, b) => a.code.localeCompare(b.code)),
};

const jsonFlag = process.argv.indexOf('--json');
if (jsonFlag !== -1 && process.argv[jsonFlag + 1]) {
  fs.writeFileSync(process.argv[jsonFlag + 1], JSON.stringify(report, null, 2));
}
console.log(
  `catálogo: ${catalogCodes.size} códigos | lançados distintos: ${thrownCodes.size} | fora do catálogo: ${outsideCatalog.length}`,
);
for (const t of outsideCatalog) {
  console.log(`  FORA: ${t.code} (${t.exception}) ${t.file}:${t.line}`);
}
if (process.argv.includes('--check') && outsideCatalog.length > 0) {
  process.exit(1);
}

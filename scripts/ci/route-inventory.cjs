#!/usr/bin/env node
/**
 * Inventário estático de rotas HTTP: método + caminho por controller.
 * Conta rotas por decorators Nest; compara com paths do contrato OpenAPI.
 * Uso: node scripts/ci/route-inventory.cjs [--json saida.json]
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
const METHOD_RX = /@(Get|Post|Patch|Put|Delete|Head|Options|All)\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)?\s*\)/g;
const CONTROLLER_RX = /@Controller\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`|\{\s*path:\s*'([^']*)'[^}]*\})?\s*\)/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

function joinPath(prefix, sub) {
  const parts = [prefix, sub]
    .filter((p) => p !== undefined && p !== null && p !== '')
    .join('/')
    .split('/')
    .filter(Boolean);
  return '/' + parts.join('/');
}

const routes = [];
for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, 'utf8');
  const ctrl = text.match(CONTROLLER_RX);
  const prefix = ctrl ? ctrl[1] ?? ctrl[2] ?? ctrl[3] ?? ctrl[4] ?? '' : '';
  let m;
  while ((m = METHOD_RX.exec(text)) !== null) {
    const sub = m[2] ?? m[3] ?? m[4] ?? '';
    routes.push({
      method: m[1].toUpperCase(),
      path: joinPath(prefix, sub),
      file: path.relative(path.join(__dirname, '..', '..'), file).replace(/\\/g, '/'),
    });
  }
}

routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

const openapiPath = path.join(__dirname, '..', '..', 'docs', 'contracts', 'openapi.json');
let openapiOps = null;
if (fs.existsSync(openapiPath)) {
  const spec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
  openapiOps = [];
  for (const [p, item] of Object.entries(spec.paths ?? {})) {
    for (const method of Object.keys(item)) {
      if (['get', 'post', 'patch', 'put', 'delete', 'head', 'options'].includes(method)) {
        openapiOps.push({ method: method.toUpperCase(), path: p });
      }
    }
  }
}

const norm = (r) => `${r.method} ${r.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`;
const srcSet = new Set(routes.map(norm));
const oaSet = openapiOps ? new Set(openapiOps.map((r) => `${r.method} ${r.path}`)) : null;

const report = {
  generatedAt: new Date().toISOString(),
  controllerFiles: walk(SRC).length,
  totalRoutes: routes.length,
  routes,
  openapi: openapiOps
    ? {
        totalOperations: openapiOps.length,
        inSourceNotInContract: [...srcSet].filter((r) => !oaSet.has(r)),
        inContractNotInSource: [...oaSet].filter((r) => !srcSet.has(r)),
      }
    : 'docs/contracts/openapi.json ausente',
};

const jsonFlag = process.argv.indexOf('--json');
if (jsonFlag !== -1 && process.argv[jsonFlag + 1]) {
  fs.writeFileSync(process.argv[jsonFlag + 1], JSON.stringify(report, null, 2));
}
console.log(
  `rotas no código: ${report.totalRoutes} | operações no contrato: ${
    openapiOps ? openapiOps.length : 'n/d'
  }`,
);
if (openapiOps) {
  console.log('só no código:', report.openapi.inSourceNotInContract);
  console.log('só no contrato:', report.openapi.inContractNotInSource);
}

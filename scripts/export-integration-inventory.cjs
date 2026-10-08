const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ts = require('typescript');

const backend = path.resolve(__dirname, '..');
const web = path.resolve(process.argv[2] || path.join(backend, '../allervia-web'));
const destination = path.join(backend, 'docs/integration-baseline');
if (!fs.existsSync(path.join(web, 'src/routes'))) throw new Error('Expected allervia-web source directory.');
const relative = (root, file) => path.relative(root, file).replaceAll('\\', '/');
function files(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : [];
  }).sort();
}
function parse(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}
const decorators = (node) => ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
function decoration(node, sf) {
  return decorators(node).map((d) => {
    const call = d.expression;
    return { name: ts.isCallExpression(call) ? call.expression.getText(sf) : call.getText(sf),
      args: ts.isCallExpression(call) ? call.arguments.map((a) => a.getText(sf)) : [] };
  });
}
const literal = (s = '') => s.replace(/^['"]|['"]$/g, '');
const line = (node, sf) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
const endpoints = [];
const dtos = [];
for (const file of files(path.join(backend, 'src'))) {
  const sf = parse(file);
  function visit(node) {
    if (ts.isClassDeclaration(node)) {
      const dec = decoration(node, sf);
      const controller = dec.find((d) => d.name === 'Controller');
      if (controller) for (const method of node.members.filter(ts.isMethodDeclaration)) {
        const methodDec = decoration(method, sf);
        const route = methodDec.find((d) => ['Get', 'Post', 'Patch', 'Put', 'Delete'].includes(d.name));
        if (route) endpoints.push({ method: route.name.toUpperCase(),
          path: '/' + [literal(controller.args[0]), literal(route.args[0])].filter(Boolean).join('/'),
          controller: node.name?.text, handler: method.name.getText(sf),
          source: relative(backend, file), line: line(method, sf),
          decorators: [...dec, ...methodDec],
          parameters: method.parameters.map((p) => ({ name: p.name.getText(sf), type: p.type?.getText(sf), decorators: decoration(p, sf) })),
          declaredResponse: method.type?.getText(sf) || null,
          status: 'existing-source-contract-not-certified-public-schema' });
      }
      if (file.endsWith('.dto.ts')) dtos.push({ name: node.name?.text, source: relative(backend, file),
        line: line(node, sf), extends: node.heritageClauses?.map((h) => h.getText(sf)) || [],
        fields: node.members.filter(ts.isPropertyDeclaration).map((p) => ({ name: p.name.getText(sf), type: p.type?.getText(sf), optional: !!p.questionToken, decorators: decoration(p, sf) })) });
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}
const consumers = [];
const routes = [];
const actions = [];
const schemas = [];
for (const file of files(path.join(web, 'src'))) {
  const sf = parse(file);
  const source = relative(web, file);
  const imports = sf.statements.filter(ts.isImportDeclaration).map((n) => literal(n.moduleSpecifier.getText(sf)));
  if (source.startsWith('src/routes/')) routes.push({ source, imports });
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(sf).replace(/\s+/g, '');
      if (/^(fetch|axios\.)/.test(name) || /^(use.*Store|calculateNextDose|getPhase|getInductionProgress)$/.test(name)) {
        consumers.push({ source, line: line(node, sf), call: name,
          kind: /fetch|axios/.test(name) ? 'http' : /Store$/.test(name) ? 'local-store' : 'local-clinical-rule' });
      }
      if (name === 'z.object' && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
        schemas.push({ source, line: line(node, sf), fields: node.arguments[0].properties.filter(ts.isPropertyAssignment).map((p) => ({ name: p.name.getText(sf), validation: p.initializer.getText(sf) })) });
      }
    }
    if (ts.isJsxAttribute(node) && /^(onClick|onSubmit|onChange|onSelect|href|to)$/.test(node.name.getText(sf))) {
      actions.push({ source, line: line(node, sf), attribute: node.name.getText(sf), expression: node.initializer?.getText(sf) || null });
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}
const git = (cwd, args) => cp.execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const inventory = { schemaVersion: 1, generatedBy: 'scripts/export-integration-inventory.cjs',
  limitations: ['Static AST inventory; aliases, dynamic properties, spreads and inherited fields require review.',
    'Decorators and inferred responses are not a complete OpenAPI specification.',
    'Actions may be presentation-only; absence of a direct fetch does not classify the complete import graph.'],
  revisions: { backend: git(backend, ['rev-parse', 'HEAD']), web: git(web, ['rev-parse', 'HEAD']) },
  endpoints, dtos, routes, consumers, actions, schemas };
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(path.join(destination, 'source-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
const rows = endpoints.map((e) => `| ${e.method} | \`${e.path}\` | ${e.source}:${e.line} | ${e.declaredResponse || 'inferred — review required'} |`);
fs.writeFileSync(path.join(destination, 'endpoint-inventory.md'),
  '# Existing source endpoints\n\nGenerated by `npm run integration:inventory -- ../allervia-web`. This is not a certified OpenAPI schema. Proposed routes are specified separately.\n\n| Method | Route | Source | Declared response |\n| --- | --- | --- | --- |\n' + rows.join('\n') + '\n');
console.log(JSON.stringify({ endpoints: endpoints.length, dtos: dtos.length, routes: routes.length,
  consumers: consumers.length, actions: actions.length, schemaGroups: schemas.length }));

const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { X509Certificate, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '../..');
const web = resolve(root, '../allervia-web');
const cert = new X509Certificate(readFileSync(resolve(root, 'artifacts/local-server.crt')));
const pin = createHash('sha256').update(cert.publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
// Browser accepts only this locally generated key, without installing a CA in Windows.
// Chain and hostname are separately verified by verify-compose.cjs and Node API clients.
const config = {
  testDir: resolve(web, 'e2e'),
  testIgnore: ['**/mfa.spec.ts', '**/repro-crash.spec.ts'],
  outputDir: resolve(root, 'artifacts/compose-browser-results'),
  workers: 1, retries: 0, fullyParallel: false, reporter: 'list',
  use: { baseURL: 'https://localhost:8443', browserName: 'chromium',
    launchOptions: { args: [`--ignore-certificate-errors-spki-list=${pin}`] } },
};
const configPath = resolve(root, 'artifacts/compose-playwright.config.cjs');
writeFileSync(configPath, `module.exports = ${JSON.stringify(config, null, 2)};\n`);
const result = spawnSync(process.execPath, [resolve(web, 'node_modules/@playwright/test/cli.js'), 'test', '--config', configPath, ...process.argv.slice(2)], {
  cwd: web, stdio: 'inherit', env: { ...process.env, NODE_EXTRA_CA_CERTS: resolve(root, 'artifacts/local-ca.crt') },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

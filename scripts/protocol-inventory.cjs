(async () => {
  const base = process.argv[2];
  const token = process.env.ALLERVIA_INVENTORY_TOKEN;
  if (!base || !token) throw new Error('Usage: ALLERVIA_INVENTORY_TOKEN=<token> node scripts/protocol-inventory.cjs <API base URL>');
  const url = new URL('treatment-protocols/migration/inventory', base.endsWith('/') ? base : base + '/');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('HTTPS required except for localhost');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error' });
  if (!response.ok) throw new Error(`Inventory failed: HTTP ${response.status}`);
  process.stdout.write(JSON.stringify(await response.json(), null, 2) + '\n');
})().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });

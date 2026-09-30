import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ERROR_MESSAGES } from '../src/infra/errors/error-catalog';
import { defaultCodeForStatus } from '../src/infra/filters/error-envelope';

const STATUS_BY_EXCEPTION: Record<string, number> = {
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  Conflict: 409,
  Gone: 410,
  UnsupportedMediaType: 415,
  UnprocessableEntity: 422,
  TooManyRequests: 429,
  InternalServerError: 500,
  ServiceUnavailable: 503,
};

const GENERIC_STATUSES = [
  400, 401, 403, 404, 405, 409, 410, 415, 422, 429, 500, 503,
];

const THROW_SITE = /(\w+)Exception\(\s*'([A-Z][A-Z0-9_]+)'/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.name.endsWith('.ts')) return [];
    if (entry.name.endsWith('.spec.ts')) return [];
    return [path];
  });
}

function statusByCode(): Map<string, number> {
  const result = new Map<string, number>();

  for (const file of sourceFiles(resolve(__dirname, '..', 'src'))) {
    const text = readFileSync(file, 'utf8');
    for (const [, exception, code] of text.matchAll(THROW_SITE)) {
      const status = STATUS_BY_EXCEPTION[exception];
      if (status) result.set(code, status);
    }
  }

  for (const status of GENERIC_STATUSES)
    result.set(defaultCodeForStatus(status), status);
  result.set('VALIDATION_ERROR', 400);

  return result;
}

function render(entries: { code: string; message: string; status: number }[]) {
  const rows = entries
    .map(
      ({ code, status, message }) =>
        `  { code: '${code}', status: ${status}, message: ${JSON.stringify(message)} },`,
    )
    .join('\n');

  return `// Gerado por \`npm run errors:export\` no allervia-backend. Não edite à mão.

export interface ErrorCatalogEntry {
  code: string
  status: number
  message: string
}

export const ERROR_CATALOG: readonly ErrorCatalogEntry[] = [
${rows}
]
`;
}

const target = resolve(
  process.argv[2] ??
    join(__dirname, '..', 'docs', 'error-catalog.generated.ts'),
);
const statuses = statusByCode();
const entries = Object.entries(ERROR_MESSAGES)
  .map(([code, message]) => ({
    code,
    message,
    status: statuses.get(code) ?? 400,
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, render(entries), 'utf8');

const missing = entries.filter(({ code }) => !statuses.has(code));
console.log(`${entries.length} códigos exportados para ${target}`);
if (missing.length)
  console.log(
    `sem throw site localizado (status 400 assumido): ${missing.map((entry) => entry.code).join(', ')}`,
  );

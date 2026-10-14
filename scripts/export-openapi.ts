import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.ALLERVIA_DISPATCHERS_DISABLED = 'true';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://localhost:5432/contract_export_stub';
process.env.AUTH_SESSION_CSRF_SECRET =
  process.env.AUTH_SESSION_CSRF_SECRET ??
  'contract-export-stub-secret-32-bytes';
process.env.SUPER_ADMIN_REGISTRATION_KEY =
  process.env.SUPER_ADMIN_REGISTRATION_KEY ??
  'contract-export-stub-key-24chars';
process.env.EMAIL_TRANSPORT = 'log';

import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortKeysDeep(entry)]),
    );
  }
  return value;
}

async function main() {
  const prismaStub = {
    onModuleInit: () => undefined,
    onModuleDestroy: () => undefined,
    $connect: () => Promise.resolve(),
    $disconnect: () => Promise.resolve(),
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prismaStub)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Allervia HTTP contract')
      .setVersion('current')
      .build(),
  );
  await app.close();

  const stable = sortKeysDeep(document);
  const serialized = JSON.stringify(stable, null, 2) + '\n';

  const outputDirectory = resolve(__dirname, '../docs/contracts');
  mkdirSync(outputDirectory, { recursive: true });
  const contractPath = resolve(outputDirectory, 'openapi.json');
  writeFileSync(contractPath, serialized);

  const backendSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: resolve(__dirname, '..'),
    encoding: 'utf8',
  }).trim();
  const contractHash = createHash('sha256').update(serialized).digest('hex');
  const manifest = {
    backendSha,
    contractHash,
    generatedAt: new Date().toISOString(),
    paths: Object.keys(
      (stable as { paths?: Record<string, unknown> }).paths ?? {},
    ).length,
    schemas: Object.keys(
      (stable as { components?: { schemas?: Record<string, unknown> } })
        .components?.schemas ?? {},
    ).length,
  };
  writeFileSync(
    resolve(outputDirectory, 'openapi.manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  console.log(
    `OpenAPI exported: ${contractPath} (${manifest.paths} paths, ${manifest.schemas} schemas, hash ${contractHash.slice(0, 12)}…)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

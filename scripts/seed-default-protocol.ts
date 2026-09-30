import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { ProtocolCatalogService } from 'src/treatment-protocols/allergen-immunotherapy/protocol-catalog/protocol-catalog.service';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

const PROTOCOL_NAME = process.env.SEED_PROTOCOL_NAME?.trim() || 'SCIT Progressão Padrão';
const MANAGER_EMAIL = process.env.SEED_MANAGER_EMAIL?.trim();

const maintenance = (
  id: string,
  intervalDays: number,
  label: string,
  nextStepId: string,
) => ({
  id,
  label,
  phase: 'MAINTENANCE',
  concentration: '10',
  volume: '0.5',
  intervalDays,
  nextStepId,
});

const buildUp = (
  id: string,
  concentration: string,
  volume: string,
  label: string,
  nextStepId: string,
) => ({
  id,
  label,
  phase: 'BUILD_UP',
  concentration,
  volume,
  intervalDays: 7,
  nextStepId,
});

const DEFINITION = {
  schemaVersion: 1,
  engineVersion: '1',
  route: 'SUBCUTANEOUS',
  volumeUnit: 'mL',
  concentrationUnit: 'DILUTION_DENOMINATOR',
  steps: [
    buildUp('b01', '10000', '0.1', '1:10.000 · 0,1 mL', 'b02'),
    buildUp('b02', '10000', '0.2', '1:10.000 · 0,2 mL', 'b03'),
    buildUp('b03', '10000', '0.4', '1:10.000 · 0,4 mL', 'b04'),
    buildUp('b04', '10000', '0.8', '1:10.000 · 0,8 mL', 'b05'),
    buildUp('b05', '1000', '0.1', '1:1.000 · 0,1 mL', 'b06'),
    buildUp('b06', '1000', '0.2', '1:1.000 · 0,2 mL', 'b07'),
    buildUp('b07', '1000', '0.4', '1:1.000 · 0,4 mL', 'b08'),
    buildUp('b08', '1000', '0.8', '1:1.000 · 0,8 mL', 'b09'),
    buildUp('b09', '100', '0.1', '1:100 · 0,1 mL', 'b10'),
    buildUp('b10', '100', '0.2', '1:100 · 0,2 mL', 'b11'),
    buildUp('b11', '100', '0.4', '1:100 · 0,4 mL', 'b12'),
    buildUp('b12', '100', '0.8', '1:100 · 0,8 mL', 'b13'),
    buildUp('b13', '10', '0.1', '1:10 · 0,1 mL', 'b14'),
    buildUp('b14', '10', '0.2', '1:10 · 0,2 mL', 'b15'),
    buildUp('b15', '10', '0.4', '1:10 · 0,4 mL', 'm01'),
    {
      id: 'm01',
      label: '1:10 · 0,5 mL · semanal',
      phase: 'MAINTENANCE',
      concentration: '10',
      volume: '0.5',
      intervalDays: 7,
      nextStepId: 'm14-1',
    },
    maintenance('m14-1', 14, '1:10 · 0,5 mL · 14 dias (1/4)', 'm14-2'),
    maintenance('m14-2', 14, '1:10 · 0,5 mL · 14 dias (2/4)', 'm14-3'),
    maintenance('m14-3', 14, '1:10 · 0,5 mL · 14 dias (3/4)', 'm14-4'),
    maintenance('m14-4', 14, '1:10 · 0,5 mL · 14 dias (4/4)', 'm21-1'),
    maintenance('m21-1', 21, '1:10 · 0,5 mL · 21 dias (1/4)', 'm21-2'),
    maintenance('m21-2', 21, '1:10 · 0,5 mL · 21 dias (2/4)', 'm21-3'),
    maintenance('m21-3', 21, '1:10 · 0,5 mL · 21 dias (3/4)', 'm21-4'),
    maintenance('m21-4', 21, '1:10 · 0,5 mL · 21 dias (4/4)', 'm28-1'),
    maintenance('m28-1', 28, '1:10 · 0,5 mL · 28 dias (1/4)', 'm28-2'),
    maintenance('m28-2', 28, '1:10 · 0,5 mL · 28 dias (2/4)', 'm28-3'),
    maintenance('m28-3', 28, '1:10 · 0,5 mL · 28 dias (3/4)', 'm28-4'),
    maintenance('m28-4', 28, '1:10 · 0,5 mL · 28 dias (platô)', 'm28-4'),
  ],
};

async function main() {
  if (!MANAGER_EMAIL) {
    console.error(
      'defina SEED_MANAGER_EMAIL com o e-mail de um médico ou administrador já registrado.',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const catalog = app.get(ProtocolCatalogService);

  const manager = await prisma.user.findFirst({
    where: { email: { equals: MANAGER_EMAIL, mode: 'insensitive' } },
    include: {
      professional: {
        include: { professionalRoles: { where: { revokedAt: null } } },
      },
    },
  });
  if (!manager?.professional) {
    console.error(`usuário ${MANAGER_EMAIL} não encontrado ou sem cadastro profissional.`);
    await app.close();
    process.exit(1);
  }
  const roles = manager.professional.professionalRoles.map((role) => role.role);
  if (!roles.includes('PHYSICIAN') && !roles.includes('ADMINISTRATOR')) {
    console.error(`usuário ${MANAGER_EMAIL} não é médico nem administrador.`);
    await app.close();
    process.exit(1);
  }
  const payload = {
    id: manager.id,
    email: manager.email,
    type: manager.type,
    organizationId: manager.professional.organizationId,
    professionalId: manager.professional.id,
    roles,
  } as unknown as AuthenticatedUserPayload;

  const existing = await prisma.treatmentProtocol.findFirst({
    where: {
      name: PROTOCOL_NAME,
      organizationId: manager.professional.organizationId,
    },
    include: { versions: { orderBy: { number: 'desc' }, take: 1 } },
  });

  let versionId: string;
  if (existing) {
    versionId = existing.versions[0].id;
    console.log(`protocolo "${PROTOCOL_NAME}" já existe; usando versão ${versionId}.`);
  } else {
    const created = await catalog.create(
      { name: PROTOCOL_NAME, definition: DEFINITION },
      payload,
    );
    versionId = created.version.id;
    console.log(`protocolo criado (${created.protocol.id}), versão ${versionId} em DRAFT.`);
  }

  let version = await prisma.protocolVersion.findUniqueOrThrow({
    where: { id: versionId },
  });
  if (version.status === 'DRAFT') {
    await catalog.mutate(versionId, version.revision, payload, 'publish');
    version = await prisma.protocolVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    console.log('versão publicada.');
  }
  if (version.status === 'RETIRED') {
    console.error('a versão mais recente está RETIRED; crie uma nova versão antes.');
    await app.close();
    process.exit(1);
  }

  await catalog.mutate(versionId, version.revision, payload, 'default');
  console.log(
    `"${PROTOCOL_NAME}" agora é o protocolo padrão da rota SUBCUTANEOUS para a organização ${manager.professional.organizationId}.`,
  );
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

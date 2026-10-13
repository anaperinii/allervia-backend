import { demoEnvironment } from './demo-bootstrap';
import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hash } from 'bcrypt';
import { generateSync } from 'otplib';
import { NestFactory } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/infra/database/prisma.service';
import { ProtocolCatalogService } from 'src/treatment-protocols/allergen-immunotherapy/protocol-catalog/protocol-catalog.service';
import { CreateImmunotherapyUseCase } from 'src/treatment-protocols/allergen-immunotherapy/therapies/use-cases/create-immunotherapy.use-case';
import { ConfiguredDoseService } from 'src/treatment-protocols/allergen-immunotherapy/dosing/configured-dose.service';
import { DoseCorrectionService } from 'src/treatment-protocols/allergen-immunotherapy/dosing/dose-correction.service';
import { TherapyLifecycleService } from 'src/treatment-protocols/allergen-immunotherapy/therapies/therapy-lifecycle.service';
import { MfaService } from 'src/security/session/mfa.service';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

const DATASET_VERSION = 2;
const MARKER = '(seed demo)';
const PASSWORD = 'Demo!Allervia#2026';
const REFERENCE_INSTANT = '2026-10-01T09:00:00-03:00';
const CREDENTIALS_FILE = join(__dirname, '.demo-credentials.local.json');

const PROTOCOL_DEFINITION = (volumeFinal: string) => ({
  schemaVersion: 1,
  engineVersion: '1',
  route: 'SUBCUTANEOUS',
  volumeUnit: 'mL',
  concentrationUnit: 'DILUTION_DENOMINATOR',
  steps: [
    {
      id: 'b01',
      label: '1:10.000 · 0,1 mL',
      phase: 'BUILD_UP',
      concentration: '10000',
      volume: '0.1',
      intervalDays: 7,
      nextStepId: 'b02',
    },
    {
      id: 'b02',
      label: '1:10.000 · 0,2 mL',
      phase: 'BUILD_UP',
      concentration: '10000',
      volume: '0.2',
      intervalDays: 7,
      nextStepId: 'b03',
    },
    {
      id: 'b03',
      label: '1:1.000 · 0,1 mL',
      phase: 'BUILD_UP',
      concentration: '1000',
      volume: '0.1',
      intervalDays: 7,
      nextStepId: 'b04',
    },
    {
      id: 'b04',
      label: '1:1.000 · 0,2 mL',
      phase: 'BUILD_UP',
      concentration: '1000',
      volume: '0.2',
      intervalDays: 7,
      nextStepId: 'm01',
    },
    {
      id: 'm01',
      label: `1:1.000 · ${volumeFinal} mL · manutenção`,
      phase: 'MAINTENANCE',
      concentration: '1000',
      volume: volumeFinal,
      intervalDays: 28,
      nextStepId: 'm01',
    },
  ],
});

interface OrgSeed {
  key: string;
  orgName: string;
  taxId: string;
  adminEmail: string;
  physicianEmail: string;
  nurseEmail: string;
  adultPatientName: string;
  adultPatientCpf: string;
  minorPatientName: string;
  suspendedPatientName: string;
  inactivePatientName: string;
}

const ORGS: OrgSeed[] = [
  {
    key: 'aurora',
    orgName: `Clínica Aurora ${MARKER}`,
    taxId: '11111111000101',
    adminEmail: 'admin.aurora@demo.allervia.local',
    physicianEmail: 'medico.aurora@demo.allervia.local',
    nurseEmail: 'enfermeira.aurora@demo.allervia.local',
    adultPatientName: 'Paciente Adulto Aurora',
    adultPatientCpf: '39053344705',
    minorPatientName: 'Paciente Menor Aurora',
    suspendedPatientName: 'Paciente Suspenso Aurora',
    inactivePatientName: 'Paciente Inativo Aurora',
  },
  {
    key: 'boreal',
    orgName: `Clínica Boreal ${MARKER}`,
    taxId: '22222222000102',
    adminEmail: 'admin.boreal@demo.allervia.local',
    physicianEmail: 'medico.boreal@demo.allervia.local',
    nurseEmail: 'enfermeira.boreal@demo.allervia.local',
    adultPatientName: 'Paciente Adulto Boreal',
    adultPatientCpf: '32247645909',
    minorPatientName: 'Paciente Menor Boreal',
    suspendedPatientName: 'Paciente Suspenso Boreal',
    inactivePatientName: 'Paciente Inativo Boreal',
  },
];

const EXPECTED_PER_ORG = {
  users: 3,
  roles: 3,
  patients: 4,
  therapies: 4,
  protocolVersions: 3,
  appointments: 2,
};

interface CredentialRecord {
  organization: string;
  email: string;
  role: string;
  password: string;
  totpSecret?: string;
}

async function verifyCompleteness(
  prisma: PrismaService,
  seed: OrgSeed,
  organizationId: string,
): Promise<string[]> {
  const missing: string[] = [];
  const professionals = await prisma.professional.count({
    where: { organizationId },
  });
  if (professionals < EXPECTED_PER_ORG.users)
    missing.push(`professionals: ${professionals}/${EXPECTED_PER_ORG.users}`);
  const roles = await prisma.professionalRole.count({
    where: { professional: { organizationId } },
  });
  if (roles < EXPECTED_PER_ORG.roles)
    missing.push(`roles: ${roles}/${EXPECTED_PER_ORG.roles}`);
  const patients = await prisma.patient.count({ where: { organizationId } });
  if (patients < EXPECTED_PER_ORG.patients)
    missing.push(`patients: ${patients}/${EXPECTED_PER_ORG.patients}`);
  const therapies = await prisma.immunotherapy.count({
    where: { patient: { organizationId } },
  });
  if (therapies < EXPECTED_PER_ORG.therapies)
    missing.push(`therapies: ${therapies}/${EXPECTED_PER_ORG.therapies}`);
  const versions = await prisma.protocolVersion.count({
    where: { protocol: { organizationId } },
  });
  if (versions < EXPECTED_PER_ORG.protocolVersions)
    missing.push(
      `protocolVersions: ${versions}/${EXPECTED_PER_ORG.protocolVersions}`,
    );
  const appointments = await prisma.appointment.count({
    where: { organizationId },
  });
  if (appointments < EXPECTED_PER_ORG.appointments)
    missing.push(
      `appointments: ${appointments}/${EXPECTED_PER_ORG.appointments}`,
    );
  const inactivePatient = await prisma.patient.findFirst({
    where: {
      organizationId,
      fullName: seed.inactivePatientName,
      isActive: false,
    },
  });
  if (!inactivePatient) missing.push('inactive patient');
  const administeredDose = await prisma.dose.findFirst({
    where: {
      immunotherapy: { patient: { organizationId } },
      status: { in: ['ADMINISTERED_ON_SCHEDULE', 'ADMINISTERED_OFF_SCHEDULE'] },
    },
  });
  if (!administeredDose) missing.push('administered dose');
  return missing;
}

async function main() {
  console.log(
    `Demo dataset v${DATASET_VERSION} — target ${demoEnvironment.databaseLabel}; reference instant ${REFERENCE_INSTANT}.`,
  );
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const catalog = app.get(ProtocolCatalogService);
  const createImmunotherapy = app.get(CreateImmunotherapyUseCase);
  const doses = app.get(ConfiguredDoseService);
  const corrections = app.get(DoseCorrectionService);
  const lifecycle = app.get(TherapyLifecycleService);
  const mfa = app.get(MfaService);

  const passwordHash = await hash(PASSWORD, 10);
  const credentials: CredentialRecord[] = [];

  for (const seed of ORGS) {
    const existingOrg = await prisma.organization.findUnique({
      where: { name: seed.orgName },
    });
    if (existingOrg) {
      const missing = await verifyCompleteness(prisma, seed, existingOrg.id);
      if (missing.length === 0) {
        console.log(`[${seed.key}] dataset completo já presente; pulando.`);
        continue;
      }
      await app.close();
      console.error(
        `[${seed.key}] dataset INCOMPLETO (${missing.join('; ')}). ` +
          'Execute "npm run seed:demo-dataset:reset" para recriar a base exclusiva de demonstração e repita o seed.',
      );
      process.exit(1);
    }

    const organization = await prisma.organization.create({
      data: { name: seed.orgName, taxId: seed.taxId, automationEnabled: true },
    });
    console.log(`[${seed.key}] organização criada: ${organization.id}`);

    const createProfessional = async (
      email: string,
      fullName: string,
      profession: 'RECEPTIONIST' | 'PHYSICIAN' | 'NURSE',
      phoneNumber: string,
    ) => {
      const user = await prisma.user.create({
        data: { email, password: passwordHash, type: 'PROFESSIONAL' },
      });
      const professional = await prisma.professional.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          fullName,
          phoneNumber,
          profession,
        },
      });
      return { user, professional };
    };

    const admin = await createProfessional(
      seed.adminEmail,
      `Administrador ${seed.key}`,
      'RECEPTIONIST',
      '11999990001',
    );
    await prisma.professionalRole.create({
      data: {
        professionalId: admin.professional.id,
        role: Role.ADMINISTRATOR,
        grantedById: admin.professional.id,
      },
    });
    const physician = await createProfessional(
      seed.physicianEmail,
      `Médica ${seed.key}`,
      'PHYSICIAN',
      '11999990002',
    );
    await prisma.professionalRole.create({
      data: {
        professionalId: physician.professional.id,
        role: Role.PHYSICIAN,
        grantedById: admin.professional.id,
      },
    });
    const nurse = await createProfessional(
      seed.nurseEmail,
      `Enfermeira ${seed.key}`,
      'NURSE',
      '11999990003',
    );
    await prisma.professionalRole.create({
      data: {
        professionalId: nurse.professional.id,
        role: Role.NURSE,
        grantedById: admin.professional.id,
      },
    });

    credentials.push(
      {
        organization: seed.orgName,
        email: seed.adminEmail,
        role: 'ADMINISTRATOR',
        password: PASSWORD,
      },
      {
        organization: seed.orgName,
        email: seed.physicianEmail,
        role: 'PHYSICIAN',
        password: PASSWORD,
      },
      {
        organization: seed.orgName,
        email: seed.nurseEmail,
        role: 'NURSE',
        password: PASSWORD,
      },
    );

    const physicianActor: AuthenticatedUserPayload = {
      id: physician.user.id,
      email: physician.user.email,
      type: 'PROFESSIONAL',
      organizationId: organization.id,
      professionalId: physician.professional.id,
      roles: [Role.PHYSICIAN],
    } as unknown as AuthenticatedUserPayload;

    if (mfa.available) {
      const enrollment = await mfa.startEnrollment(
        admin.user.id,
        admin.user.email,
        'Autenticador (seed demo)',
      );
      const code = generateSync({ secret: enrollment.secret, period: 30 });
      await mfa.confirmEnrollment(admin.user.id, enrollment.credentialId, code);
      const record = credentials.find((c) => c.email === seed.adminEmail);
      if (record) record.totpSecret = enrollment.secret;
      console.log(
        `[${seed.key}] MFA confirmado para ${admin.user.email} (segredo registrado apenas no arquivo local de credenciais).`,
      );
    } else {
      console.log(
        `[${seed.key}] MFA indisponível (chave de cifragem não configurada); contas seguem sem MFA.`,
      );
    }

    const createdV1 = await catalog.create(
      {
        name: `Protocolo padrão ${seed.key}`,
        definition: PROTOCOL_DEFINITION('0.5'),
      },
      physicianActor,
    );
    await catalog.mutate(
      createdV1.version.id,
      createdV1.version.revision,
      physicianActor,
      'publish',
    );
    const publishedV1 = await prisma.protocolVersion.findUniqueOrThrow({
      where: { id: createdV1.version.id },
    });

    const v2 = await catalog.createVersion(
      createdV1.protocol.id,
      PROTOCOL_DEFINITION('0.6'),
      physicianActor,
    );
    await catalog.mutate(v2.id, v2.revision, physicianActor, 'publish');
    const publishedV2 = await prisma.protocolVersion.findUniqueOrThrow({
      where: { id: v2.id },
    });
    await catalog.mutate(
      publishedV2.id,
      publishedV2.revision,
      physicianActor,
      'default',
    );

    const draftV3 = await catalog.createVersion(
      createdV1.protocol.id,
      PROTOCOL_DEFINITION('0.8'),
      physicianActor,
    );
    console.log(
      `[${seed.key}] protocolo ${createdV1.protocol.id}: v1 publicada ${publishedV1.id}, v2 padrão ${publishedV2.id}, rascunho ${draftV3.id}`,
    );

    const createTherapy = (
      label: string,
      patient: Record<string, unknown>,
      versionId: string,
      startingStepId: string,
    ) =>
      createImmunotherapy.execute(
        {
          patient,
          idempotencyKey: `seed-v${DATASET_VERSION}-${seed.key}-${label}`,
          immunoType: 'Ácaros',
          administrationRoute: 'SUBCUTANEOUS',
          extract: 'Ácaros padronizado 50% D. pteronyssinus / 50% D. farinae',
          inductionStartDate: REFERENCE_INSTANT,
          protocolVersionId: versionId,
          stepIds: ['b01', 'b02', 'b03', 'b04', 'm01'],
          startingStepId,
          targetStepId: 'm01',
        } as never,
        physicianActor,
      );

    const adultTherapy = await createTherapy(
      'adult',
      {
        fullName: seed.adultPatientName,
        birthDate: '1990-05-10',
        weightInKg: 70,
        phoneNumber: '11988880001',
        cpf: seed.adultPatientCpf,
        responsiblePhysicianId: physician.professional.id,
      },
      publishedV1.id,
      'b01',
    );
    await createTherapy(
      'minor',
      {
        fullName: seed.minorPatientName,
        birthDate: '2015-03-20',
        weightInKg: 32,
        phoneNumber: '11988880002',
        responsiblePhysicianId: physician.professional.id,
        guardian: {
          fullName: `Responsável de ${seed.minorPatientName}`,
          phoneNumber: '11988880003',
        },
      },
      publishedV2.id,
      'b03',
    );
    const suspendedTherapy = await createTherapy(
      'suspended',
      {
        fullName: seed.suspendedPatientName,
        birthDate: '1985-01-15',
        weightInKg: 80,
        phoneNumber: '11988880004',
        responsiblePhysicianId: physician.professional.id,
      },
      publishedV2.id,
      'b01',
    );
    const completedTherapy = await createTherapy(
      'completed',
      {
        fullName: seed.inactivePatientName,
        birthDate: '1978-07-02',
        weightInKg: 65,
        phoneNumber: '11988880005',
        responsiblePhysicianId: physician.professional.id,
      },
      publishedV1.id,
      'm01',
    );

    const adultTherapyId = (adultTherapy as { immunotherapy: { id: string } })
      .immunotherapy.id;
    const pendingDose = await prisma.dose.findFirstOrThrow({
      where: { immunotherapyId: adultTherapyId, status: 'SCHEDULED' },
      orderBy: { scheduledAt: 'asc' },
    });
    const adultTherapyRow = await prisma.immunotherapy.findUniqueOrThrow({
      where: { id: adultTherapyId },
    });
    const administered = await doses.administer(
      pendingDose.id,
      {
        idempotencyKey: `seed-v${DATASET_VERSION}-${seed.key}-dose-01`,
        expectedRevision: (pendingDose as { revision: number }).revision,
        expectedTherapyRevision: (adultTherapyRow as { revision: number })
          .revision,
        values: {
          concentration: String(pendingDose.concentration),
          volume: pendingDose.volume.toString(),
          intervalDays: pendingDose.nextIntervalInDays,
          stepId: 'b01',
        },
        administeredAt: REFERENCE_INSTANT,
        betweenDosesReport: 'Sem intercorrências desde a última sessão.',
        administeredById: nurse.user.id,
      } as never,
      physicianActor,
    );
    const administeredDoseId = (administered as { dose: { id: string } }).dose
      .id;
    const therapyAfterDose = await prisma.immunotherapy.findUniqueOrThrow({
      where: { id: adultTherapyId },
    });
    await corrections.addLateObservation(
      administeredDoseId,
      {
        reportedSideEffects: ['Eritema local leve'],
        administeredMedications: [],
        notes: 'Observação sintética registrada após a sessão.',
        observedAt: '2026-10-01T11:00:00-03:00',
        expectedTherapyRevision: (therapyAfterDose as { revision: number })
          .revision,
      } as never,
      physicianActor,
    );
    console.log(
      `[${seed.key}] dose administrada ${administeredDoseId} com observação posterior.`,
    );

    const suspendTarget = await prisma.immunotherapy.findUniqueOrThrow({
      where: {
        id: (suspendedTherapy as { immunotherapy: { id: string } })
          .immunotherapy.id,
      },
    });
    await lifecycle.execute(
      suspendTarget.id,
      {
        action: 'SUSPEND',
        expectedRevision: (suspendTarget as { revision: number }).revision,
        reason: 'Suspensão sintética para demonstração.',
      } as never,
      physicianActor,
    );
    const completeTarget = await prisma.immunotherapy.findUniqueOrThrow({
      where: {
        id: (completedTherapy as { immunotherapy: { id: string } })
          .immunotherapy.id,
      },
    });
    await lifecycle.execute(
      completeTarget.id,
      {
        action: 'COMPLETE',
        expectedRevision: (completeTarget as { revision: number }).revision,
        reason: 'Tratamento concluído (dados sintéticos).',
      } as never,
      physicianActor,
    );
    await prisma.patient.updateMany({
      where: {
        organizationId: organization.id,
        fullName: seed.inactivePatientName,
      },
      data: { isActive: false },
    });
    console.log(
      `[${seed.key}] terapias: andamento (adulto/menor), suspensa, concluída com paciente inativo.`,
    );

    const minorPatient = await prisma.patient.findFirstOrThrow({
      where: {
        fullName: seed.minorPatientName,
        organizationId: organization.id,
      },
    });
    const adultPatient = await prisma.patient.findFirstOrThrow({
      where: {
        fullName: seed.adultPatientName,
        organizationId: organization.id,
      },
    });
    const futureStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await prisma.appointment.create({
      data: {
        organization: { connect: { id: organization.id } },
        patient: { connect: { id: minorPatient.id } },
        professional: { connect: { id: physician.professional.id } },
        createdBy: { connect: { id: physician.user.id } },
        updatedBy: { connect: { id: physician.user.id } },
        title: 'Retorno de acompanhamento (seed demo)',
        startsAt: futureStart,
        endsAt: new Date(futureStart.getTime() + 30 * 60 * 1000),
        status: 'SCHEDULED',
      },
    });
    await prisma.appointment.create({
      data: {
        organization: { connect: { id: organization.id } },
        patient: { connect: { id: adultPatient.id } },
        professional: { connect: { id: physician.professional.id } },
        createdBy: { connect: { id: physician.user.id } },
        updatedBy: { connect: { id: physician.user.id } },
        title: 'Sessão cancelada (seed demo)',
        startsAt: new Date('2026-10-05T10:00:00-03:00'),
        endsAt: new Date('2026-10-05T10:30:00-03:00'),
        status: 'CANCELLED',
      },
    });
    console.log(
      `[${seed.key}] compromissos: futuro (relativo a ${new Date().toISOString()}) e cancelado fixo.`,
    );
  }

  const pendingRequest = await prisma.demoRequest.findFirst({
    where: { email: 'interessado@demo.allervia.local' },
  });
  if (!pendingRequest) {
    await prisma.demoRequest.create({
      data: {
        requestId: randomUUID(),
        name: 'Interessado',
        lastName: 'Demo',
        email: 'interessado@demo.allervia.local',
        phone: '11988880009',
        role: 'Gestor',
        solution: 'Allervia',
        specialty: 'Alergologia',
        professionals: 5,
        sourceHash: createHash('sha256').update('seed-demo').digest('hex'),
      },
    });
    console.log(
      'Solicitação de demonstração pendente criada (despachantes desabilitados; nenhum email é enviado).',
    );
  }

  if (credentials.length > 0) {
    writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(
        {
          datasetVersion: DATASET_VERSION,
          referenceInstant: REFERENCE_INSTANT,
          generatedAt: new Date().toISOString(),
          credentials,
        },
        null,
        2,
      ),
    );
    console.log(
      `\nCredenciais de demonstração gravadas em ${CREDENTIALS_FILE} (ignorado pelo Git). Nenhum segredo TOTP aparece neste log.`,
    );
  } else {
    console.log(
      `\nNenhuma organização nova; arquivo de credenciais existente preservado (${CREDENTIALS_FILE}).`,
    );
  }

  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

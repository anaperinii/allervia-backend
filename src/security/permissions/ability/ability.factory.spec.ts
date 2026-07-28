import { subject } from '@casl/ability';
import { Patient } from '@prisma/client';
import { AbilityFactory, AbilityUser } from './ability.factory';

describe('AbilityFactory', () => {
  const factory = new AbilityFactory();

  const ORG = 'org-1';
  const OTHER_ORG = 'org-2';

  const buildUser = (overrides: Partial<AbilityUser>): AbilityUser => ({
    id: 'user-1',
    organizationId: ORG,
    professionalId: 'prof-1',
    roles: [],
    ...overrides,
  });

  // Helpers: só preenchemos os campos que as conditions olham; o cast mantém o
  // teste tipado (sem `any`). `immuno` usa forma aninhada (posse via paciente).
  const patient = (data: Partial<Patient>) =>
    subject('Patient', data as Patient);

  describe('ADMINISTRATOR', () => {
    const ability = factory.createForUser(
      buildUser({ roles: ['ADMINISTRATOR'] }),
    );

    it('lê paciente da própria organização', () => {
      expect(ability.can('read', patient({ organizationId: ORG }))).toBe(true);
    });

    it('NÃO edita paciente (clínico é só leitura)', () => {
      expect(ability.can('update', patient({ organizationId: ORG }))).toBe(
        false,
      );
    });

    it('não lê paciente de outra organização', () => {
      expect(ability.can('read', patient({ organizationId: OTHER_ORG }))).toBe(
        false,
      );
    });

    it('pode gerenciar convites (nível de tipo, para a rota)', () => {
      expect(ability.can('create', 'InternalUserInvite')).toBe(true);
    });

    it('pode gerenciar usuários (nível de tipo, para a rota)', () => {
      expect(ability.can('update', 'User')).toBe(true);
    });
  });

  describe('PHYSICIAN', () => {
    const ability = factory.createForUser(
      buildUser({ roles: ['PHYSICIAN'], professionalId: 'prof-1' }),
    );

    it('lê apenas o próprio paciente (é o médico responsável)', () => {
      expect(
        ability.can('read', patient({ responsiblePhysicianId: 'prof-1' })),
      ).toBe(true);
    });

    it('NÃO lê paciente de outro médico responsável', () => {
      expect(
        ability.can('read', patient({ responsiblePhysicianId: 'prof-2' })),
      ).toBe(false);
    });

    it('arquiva o próprio paciente (é o médico responsável)', () => {
      expect(
        ability.can('archive', patient({ responsiblePhysicianId: 'prof-1' })),
      ).toBe(true);
    });

    it('NÃO arquiva paciente de outro médico responsável', () => {
      expect(
        ability.can('archive', patient({ responsiblePhysicianId: 'prof-2' })),
      ).toBe(false);
    });

    it('pode criar imunoterapia (nível de tipo)', () => {
      expect(ability.can('create', 'Immunotherapy')).toBe(true);
    });

    // Posse de imunoterapia é derivada (patient.responsiblePhysicianId). O
    // matcher de instância do @casl/prisma não avalia relação aninhada, então
    // a posse é escopada na query via accessibleBy (Fase 4) — validada lá.
    // No nível da rota (tipo), o médico pode atualizar imunoterapia.
    it('pode atualizar imunoterapia (nível de tipo)', () => {
      expect(ability.can('update', 'Immunotherapy')).toBe(true);
    });
  });

  describe('NURSE', () => {
    const ability = factory.createForUser(buildUser({ roles: ['NURSE'] }));

    it('NÃO pode criar imunoterapia', () => {
      expect(ability.can('create', 'Immunotherapy')).toBe(false);
    });

    it('pode registrar dose — create (nível de tipo)', () => {
      expect(ability.can('create', 'Dose')).toBe(true);
    });

    it('pode arquivar dose (nível de tipo)', () => {
      expect(ability.can('archive', 'Dose')).toBe(true);
    });
  });

  describe('RECEPTIONIST', () => {
    const ability = factory.createForUser(
      buildUser({ roles: ['RECEPTIONIST'] }),
    );

    it('pode ler paciente da própria organização', () => {
      expect(ability.can('read', patient({ organizationId: ORG }))).toBe(true);
    });

    it('NÃO pode registrar dose', () => {
      expect(ability.can('create', 'Dose')).toBe(false);
    });
  });
});

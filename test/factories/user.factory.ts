import { Prisma, Role, User } from '@prisma/client';
import { BaseFactory } from './base.factory';
import { faker } from '@faker-js/faker';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

export class UserFactory extends BaseFactory<User> {
  // Fornece campos sem default e não opcionais no schema (User = credencial/status)
  protected getDefaultData(): Partial<User> {
    return {
      email: faker.internet.email(),
      password: 'hashed_password',
      type: 'PROFESSIONAL',
    };
  }

  async create(overrides: Partial<User> = {}): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...this.getDefaultData(),
        ...overrides,
      } as Prisma.UserCreateInput,
    });
  }

  async createInOrganization(
    organizationId: string,
    overrides: Partial<User> = {},
  ): Promise<User> {
    const user = await this.create({ ...overrides, type: 'PROFESSIONAL' });
    await this.prisma.professional.create({
      data: {
        userId: user.id,
        organizationId,
        fullName: faker.person.fullName(),
        phoneNumber: faker.phone.number(),
        profession: 'PHYSICIAN',
      },
    });
    return user;
  }

  private async createOrganization() {
    return this.prisma.organization.create({
      data: {
        name: faker.company.name(),
        taxId: faker.string.numeric(14),
      },
    });
  }

  private async createProfessionalUser(
    roles: Role[],
    overrides: Partial<User> = {},
  ): Promise<AuthenticatedUserPayload> {
    const organization = await this.createOrganization();
    const user = await this.create({ ...overrides, type: 'PROFESSIONAL' });

    const professional = await this.prisma.professional.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        fullName: faker.person.fullName(),
        phoneNumber: faker.phone.number(),
        profession: 'PHYSICIAN',
      },
    });

    await this.prisma.professionalRole.createMany({
      data: roles.map((role) => ({
        professionalId: professional.id,
        role,
        grantedById: professional.id,
      })),
    });

    return {
      id: user.id,
      email: user.email,
      type: 'PROFESSIONAL',
      organizationId: organization.id,
      professionalId: professional.id,
      roles,
    };
  }

  async createAuthenticatedPhysicianProfessional(
    overrides: Partial<User> = {},
  ): Promise<AuthenticatedUserPayload> {
    return this.createProfessionalUser(['PHYSICIAN'], overrides);
  }

  async createAuthenticatedAdmin(
    overrides: Partial<User> = {},
  ): Promise<AuthenticatedUserPayload> {
    return this.createProfessionalUser(['ADMINISTRATOR'], overrides);
  }

  async createAuthenticatedNurse(
    overrides: Partial<User> = {},
  ): Promise<AuthenticatedUserPayload> {
    return this.createProfessionalUser(['NURSE'], overrides);
  }

  /**
   * Profissional na mesma organização de um usuário já criado, com os papéis
   * indicados. Papel forjado apenas no token não vale: a autorização é
   * recarregada do banco a cada requisição.
   */
  async createColleagueWithRoles(
    organizationId: string,
    roles: Role[],
    overrides: Partial<User> = {},
  ): Promise<AuthenticatedUserPayload> {
    const user = await this.create({ ...overrides, type: 'PROFESSIONAL' });

    const professional = await this.prisma.professional.create({
      data: {
        userId: user.id,
        organizationId,
        fullName: faker.person.fullName(),
        phoneNumber: faker.phone.number(),
        profession: 'NURSE',
      },
    });

    await this.prisma.professionalRole.createMany({
      data: roles.map((role) => ({
        professionalId: professional.id,
        role,
        grantedById: professional.id,
      })),
    });

    return {
      id: user.id,
      email: user.email,
      type: 'PROFESSIONAL',
      organizationId,
      professionalId: professional.id,
      roles,
    };
  }
}

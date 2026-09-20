import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  UserCreationData,
  UserUpdateData,
} from 'src/account/account.interface';
import {
  AccountProfileRow,
  IUserRepository,
} from 'src/account/user.repository';

/**
 * Seleção pública do perfil de conta. Enumerar os campos aqui é o que impede
 * que `password`, `tokenVersion` ou relações internas cheguem à resposta.
 */
const accountProfileSelection = {
  id: true,
  email: true,
  type: true,
  isActive: true,
  createdAt: true,
  professional: {
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
      profession: true,
      councilNumber: true,
      councilUf: true,
      organization: {
        select: {
          id: true,
          name: true,
          timeZone: true,
          automationEnabled: true,
        },
      },
      professionalRoles: {
        where: { revokedAt: null },
        select: { role: true },
      },
    },
  },
  patient: {
    select: {
      organization: {
        select: {
          id: true,
          name: true,
          timeZone: true,
          automationEnabled: true,
        },
      },
    },
  },
  mfaCredentials: {
    where: { revokedAt: null, confirmedAt: { not: null } },
    select: { id: true },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class PrismaUserRepository extends IUserRepository {
  constructor(private prismaService: PrismaService) {
    super();
  }

  async findAccountProfile(userId: string): Promise<AccountProfileRow | null> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: accountProfileSelection,
    });

    if (!user) return null;

    const professional = user.professional;

    return {
      user: {
        id: user.id,
        email: user.email,
        type: user.type,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      professional: professional
        ? {
            id: professional.id,
            fullName: professional.fullName,
            phoneNumber: professional.phoneNumber,
            profession: professional.profession,
            councilNumber: professional.councilNumber,
            councilUf: professional.councilUf,
          }
        : null,
      organization:
        professional?.organization ?? user.patient?.organization ?? null,
      roles: professional?.professionalRoles.map((item) => item.role) ?? [],
      hasConfirmedMfa: user.mfaCredentials.length > 0,
    };
  }

  async create(user: UserCreationData, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prismaService;

    return client.user.create({ data: user });
  }

  async update(user: Partial<UserUpdateData>, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prismaService;

    return client.user.update({
      where: { id: user.id },
      data: {
        email: user.email,
        password: user.password,
        tokenVersion:
          user.password !== undefined ||
          user.isActive === false ||
          user.isArchived === true
            ? { increment: 1 }
            : undefined,
        isActive: user.isActive,
        isArchived: user.isArchived,
      },
    });
  }

  async findUserByEmail(email: string) {
    return this.prismaService.user.findFirst({
      where: { email, isActive: true, isArchived: false },
    });
  }

  async findUserById(id: string) {
    return this.prismaService.user.findFirst({ where: { id } });
  }

  async findUserByIdInOrganization(id: string, organizationId: string) {
    if (!organizationId) return null;
    return this.prismaService.user.findFirst({
      where: {
        id,
        OR: [
          { professional: { organizationId } },
          { patient: { organizationId } },
        ],
      },
    });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prismaService.user.count({ where: { email } });

    return count > 0;
  }

  async changePassword(
    userId: string,
    passwordHash: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prismaService;

    await client.user.update({
      where: { id: userId },
      data: { password: passwordHash, tokenVersion: { increment: 1 } },
    });
  }
}

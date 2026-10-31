import { ConflictException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, VerificationPurpose } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { CodedHttpException } from 'src/infra/exceptions/coded.exception';
import { IUserAuthRepository } from './interfaces/user-auth.repository.interface';
import {
  ActiveVerificationToken,
  CreateVerificationTokenParams,
  UserForAuth,
} from './types/user-auth.repository.types';
import { AUTH_ERROR_CODES, AUTH_MESSAGES } from './auth.messages';

@Injectable()
export class PrismaUserAuthRepository extends IUserAuthRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByEmailForAuth(email: string): Promise<UserForAuth | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        professional: {
          include: {
            professionalRoles: { where: { revokedAt: null } },
          },
        },
        patient: true,
      },
    });

    if (!user) {
      return null;
    }

    const organizationId =
      user.professional?.organizationId ?? user.patient?.organizationId ?? null;

    return {
      id: user.id,
      email: user.email,
      password: user.password,
      type: user.type,
      organizationId,
      professionalId: user.professional?.id ?? null,
      roles: user.professional?.professionalRoles.map((pr) => pr.role) ?? [],
      tokenVersion: user.tokenVersion,
    };
  }

  async createVerificationToken(
    params: CreateVerificationTokenParams,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.verificationToken.updateMany({
        where: {
          userId: params.userId,
          purpose: params.purpose,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      }),
      this.prisma.verificationToken.create({ data: { ...params } }),
    ]);
  }

  async findActiveVerificationToken(
    tokenHash: string,
    purpose: VerificationPurpose,
    requireApproved = false,
  ): Promise<ActiveVerificationToken | null> {
    const token = await this.prisma.verificationToken.findFirst({
      where: {
        tokenHash,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        ...(requireApproved ? { approvedAt: { not: null } } : {}),
      },
      select: {
        id: true,
        userId: true,
        newEmail: true,
        approvedAt: true,
        expiresAt: true,
        user: { select: { email: true, password: true } },
      },
    });

    if (!token) {
      return null;
    }

    return {
      id: token.id,
      userId: token.userId,
      userEmail: token.user.email,
      userPassword: token.user.password,
      newEmail: token.newEmail,
      approvedAt: token.approvedAt,
      expiresAt: token.expiresAt,
    };
  }

  async countRecentVerificationTokens(
    userId: string,
    purpose: VerificationPurpose,
    since: Date,
  ): Promise<number> {
    return this.prisma.verificationToken.count({
      where: { userId, purpose, createdAt: { gte: since } },
    });
  }

  async findOrganizationIdByUserId(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string | null> {
    const client = tx ?? this.prisma;

    const user = await client.user.findUnique({
      where: { id: userId },
      select: {
        professional: { select: { organizationId: true } },
        patient: { select: { organizationId: true } },
      },
    });

    return (
      user?.professional?.organizationId ??
      user?.patient?.organizationId ??
      null
    );
  }

  async finalizePasswordReset(
    tokenId: string,
    userId: string,
    passwordHash: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (tx) {
      return this.applyPasswordReset(tx, tokenId, userId, passwordHash);
    }

    await this.prisma.$transaction((trx) =>
      this.applyPasswordReset(trx, tokenId, userId, passwordHash),
    );
  }

  async finalizeEmailChange(
    tokenId: string,
    userId: string,
    newEmail: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (tx) {
      return this.applyEmailChange(tx, tokenId, userId, newEmail);
    }

    await this.prisma.$transaction((trx) =>
      this.applyEmailChange(trx, tokenId, userId, newEmail),
    );
  }

  private async applyEmailChange(
    client: Prisma.TransactionClient,
    tokenId: string,
    userId: string,
    newEmail: string,
  ): Promise<void> {
    const consumed = await client.verificationToken.updateMany({
      where: { id: tokenId, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    if (consumed.count === 0) {
      throw new ConflictException(AUTH_MESSAGES.emailChangeTokenAlreadyUsed);
    }

    try {
      await client.user.update({
        where: { id: userId },
        data: { email: newEmail, tokenVersion: { increment: 1 } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new CodedHttpException(
          HttpStatus.CONFLICT,
          AUTH_ERROR_CODES.emailAlreadyInUse,
          AUTH_MESSAGES.emailAlreadyInUse,
        );
      }
      throw error;
    }
  }

  private async applyPasswordReset(
    client: Prisma.TransactionClient,
    tokenId: string,
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    const consumed = await client.verificationToken.updateMany({
      where: { id: tokenId, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    if (consumed.count === 0) {
      throw new ConflictException(AUTH_MESSAGES.resetTokenAlreadyUsed);
    }

    await client.user.update({
      where: { id: userId },
      data: { password: passwordHash, tokenVersion: { increment: 1 } },
    });
  }
}

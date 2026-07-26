import { ConflictException, Injectable } from '@nestjs/common';
import { VerificationPurpose } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IUserAuthRepository } from './interfaces/user-auth.repository.interface';
import {
  ActiveVerificationToken,
  CreateVerificationTokenParams,
  UserForAuth,
} from './types/user-auth.repository.types';
import { AUTH_MESSAGES } from './auth.messages';

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

  async getCurrentTokenVersion(userId: string): Promise<number | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });

    return user?.tokenVersion ?? null;
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
  ): Promise<ActiveVerificationToken | null> {
    const token = await this.prisma.verificationToken.findFirst({
      where: {
        tokenHash,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true, user: { select: { email: true } } },
    });

    if (!token) {
      return null;
    }

    return { id: token.id, userId: token.userId, userEmail: token.user.email };
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

  async finalizePasswordReset(
    tokenId: string,
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.verificationToken.updateMany({
        where: { id: tokenId, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      if (consumed.count === 0) {
        throw new ConflictException(AUTH_MESSAGES.resetTokenAlreadyUsed);
      }

      await tx.user.update({
        where: { id: userId },
        data: { password: passwordHash, tokenVersion: { increment: 1 } },
      });
    });
  }
}

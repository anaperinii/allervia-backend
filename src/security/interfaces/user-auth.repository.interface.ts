import { Prisma, VerificationPurpose } from '@prisma/client';
import {
  ActiveVerificationToken,
  CreateVerificationTokenParams,
  UserForAuth,
} from 'src/security/types/user-auth.repository.types';

export abstract class IUserAuthRepository {
  abstract findByEmailForAuth(email: string): Promise<UserForAuth | null>;

  abstract getCurrentTokenVersion(userId: string): Promise<number | null>;

  abstract hasConfirmedMfaCredential(userId: string): Promise<boolean>;

  abstract createVerificationToken(
    params: CreateVerificationTokenParams,
  ): Promise<void>;

  abstract findActiveVerificationToken(
    tokenHash: string,
    purpose: VerificationPurpose,
  ): Promise<ActiveVerificationToken | null>;

  abstract countRecentVerificationTokens(
    userId: string,
    purpose: VerificationPurpose,
    since: Date,
  ): Promise<number>;

  abstract findOrganizationIdByUserId(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string | null>;

  abstract finalizePasswordReset(
    tokenId: string,
    userId: string,
    passwordHash: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}

import { Injectable } from '@nestjs/common';
import { VerificationPurpose } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { buildPage, PageQueryDto, resolvePage } from 'src/infra/http/pagination';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import {
  EmailChangeRequestDto,
  EmailChangeRequestPageDto,
  type EmailChangeStatus,
} from '../dtos/request-email-change.dto';

interface StatusSource {
  approvedAt: Date | null;
  rejectedAt: Date | null;
  consumedAt: Date | null;
  expiresAt: Date;
}

function resolveStatus(row: StatusSource, now: Date): EmailChangeStatus {
  if (row.rejectedAt) return 'REJECTED';
  if (row.consumedAt) return row.approvedAt ? 'CONFIRMED' : 'SUPERSEDED';
  if (row.expiresAt <= now) return 'EXPIRED';
  return row.approvedAt ? 'DISPATCHED' : 'PENDING';
}

function resolveDecidedAt(row: StatusSource): Date | null {
  return row.rejectedAt ?? row.consumedAt ?? null;
}

@Injectable()
export class ListEmailChangeRequestsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    currentUser: AuthenticatedUserPayload,
    query: PageQueryDto,
  ): Promise<EmailChangeRequestPageDto> {
    const bounds = resolvePage(query);
    const now = new Date();
    const where = {
      purpose: VerificationPurpose.EMAIL_CHANGE,
      user: { professional: { organizationId: currentUser.organizationId } },
    };

    const [rows, total, pending] = await this.prisma.$transaction([
      this.prisma.verificationToken.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: bounds.skip,
        take: bounds.take,
        select: {
          id: true,
          newEmail: true,
          createdAt: true,
          expiresAt: true,
          approvedAt: true,
          rejectedAt: true,
          consumedAt: true,
          user: {
            select: {
              email: true,
              professional: { select: { id: true, fullName: true } },
            },
          },
        },
      }),
      this.prisma.verificationToken.count({ where }),
      this.prisma.verificationToken.count({
        where: {
          ...where,
          approvedAt: null,
          rejectedAt: null,
          consumedAt: null,
          expiresAt: { gt: now },
        },
      }),
    ]);

    const items = rows.map<EmailChangeRequestDto>((row) => ({
      id: row.id,
      professionalId: row.user.professional?.id ?? '',
      professionalName: row.user.professional?.fullName ?? '',
      currentEmail: row.user.email,
      newEmail: row.newEmail ?? '',
      status: resolveStatus(row, now),
      expiresAt: row.expiresAt,
      requestedAt: row.createdAt,
      decidedAt: resolveDecidedAt(row),
    }));

    return { ...buildPage(items, total, bounds), pending };
  }
}

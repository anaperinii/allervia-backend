import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import {
  buildPage,
  PageQueryDto,
  resolvePage,
} from 'src/infra/http/pagination';

export interface OutboxPayload {
  therapyId: string;
  patientId: string;
  patientName: string;
  doseId?: string;
  reason: string;
  /** Destinatário resolvido no commit de origem: o médico responsável. */
  recipientProfessionalId: string;
}

/** Grava o evento de saída DENTRO da transação do fato de origem. */
export function enqueueOutbox(
  tx: Prisma.TransactionClient,
  organizationId: string,
  kind: NotificationKind,
  payload: OutboxPayload,
) {
  return tx.outboxEvent.create({
    data: {
      organizationId,
      kind,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });
}

const TITLES: Record<NotificationKind, string> = {
  PHYSICIAN_REVIEW_REQUESTED: 'Avaliação médica solicitada',
  TREATMENT_SUSPENDED: 'Tratamento suspenso',
};

const MAX_ATTEMPTS = 5;

/**
 * Notificações internas derivadas de eventos persistidos. O consumidor é
 * idempotente por construção (unicidade evento+destinatário) e registra
 * tentativas/falhas visíveis; canais externos entram aqui quando houver
 * provedor definido — nunca um envio simulado.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Processa eventos pendentes; seguro para reexecução e concorrência. */
  async processPending(
    limit = 20,
  ): Promise<{ processed: number; failed: number }> {
    const pending = await this.prisma.outboxEvent.findMany({
      where: { processedAt: null, attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    let processed = 0;
    let failed = 0;
    for (const event of pending) {
      try {
        const payload = event.payload as unknown as OutboxPayload;
        const recipient = await this.prisma.professional.findFirst({
          where: {
            id: payload.recipientProfessionalId,
            organizationId: event.organizationId,
          },
          select: { userId: true, user: { select: { isActive: true } } },
        });
        await this.prisma.$transaction(async (tx) => {
          if (recipient && recipient.user.isActive) {
            const preference = await tx.notificationPreference.findUnique({
              where: {
                userId_kind: { userId: recipient.userId, kind: event.kind },
              },
            });
            if (preference?.enabled !== false) {
              // Idempotente: replay do mesmo evento não duplica a notificação.
              await tx.notification.upsert({
                where: {
                  outboxEventId_userId: {
                    outboxEventId: event.id,
                    userId: recipient.userId,
                  },
                },
                update: {},
                create: {
                  organizationId: event.organizationId,
                  userId: recipient.userId,
                  outboxEventId: event.id,
                  kind: event.kind,
                  title: TITLES[event.kind],
                  body: `${payload.patientName}: ${payload.reason}`,
                  entityType: 'Immunotherapy',
                  entityId: payload.therapyId,
                },
              });
            }
          }
          await tx.outboxEvent.update({
            where: { id: event.id },
            data: { processedAt: new Date() },
          });
        });
        processed += 1;
      } catch (error) {
        failed += 1;
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            attempts: { increment: 1 },
            lastError:
              error instanceof Error ? error.message.slice(0, 500) : 'unknown',
          },
        });
      }
    }
    return { processed, failed };
  }

  async list(
    query: PageQueryDto & { unreadOnly?: boolean },
    user: AuthenticatedUserPayload,
  ) {
    const bounds = resolvePage(query);
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      organizationId: user.organizationId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };
    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: bounds.skip,
        take: bounds.take,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          userId: user.id,
          organizationId: user.organizationId,
          readAt: null,
        },
      }),
    ]);
    return { ...buildPage(items, total, bounds), unread };
  }

  async markRead(id: string, user: AuthenticatedUserPayload) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: user.id, organizationId: user.organizationId },
    });
    if (!notification) throw new NotFoundException();
    if (notification.readAt) return notification;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(user: AuthenticatedUserPayload) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId: user.id,
        organizationId: user.organizationId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { marked: result.count };
  }

  async preferences(user: AuthenticatedUserPayload) {
    const stored = await this.prisma.notificationPreference.findMany({
      where: { userId: user.id },
    });
    const byKind = new Map(stored.map((row) => [row.kind, row.enabled]));
    return Object.values(NotificationKind).map((kind) => ({
      kind,
      enabled: byKind.get(kind) ?? true,
    }));
  }

  async setPreference(
    kind: NotificationKind,
    enabled: boolean,
    user: AuthenticatedUserPayload,
  ) {
    await this.prisma.notificationPreference.upsert({
      where: { userId_kind: { userId: user.id, kind } },
      update: { enabled },
      create: { userId: user.id, kind, enabled },
    });
    return this.preferences(user);
  }

  /** Status do outbox para administração: pendências e falhas visíveis. */
  async outboxStatus(user: AuthenticatedUserPayload) {
    const where = { organizationId: user.organizationId };
    const [pending, failing, lastFailures] = await this.prisma.$transaction([
      this.prisma.outboxEvent.count({ where: { ...where, processedAt: null } }),
      this.prisma.outboxEvent.count({
        where: { ...where, processedAt: null, attempts: { gte: MAX_ATTEMPTS } },
      }),
      this.prisma.outboxEvent.findMany({
        where: { ...where, lastError: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          kind: true,
          attempts: true,
          lastError: true,
          createdAt: true,
          processedAt: true,
        },
      }),
    ]);
    return { pending, deadLettered: failing, lastFailures };
  }
}

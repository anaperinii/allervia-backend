import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationKind, OutboxEvent, Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
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
  recipientProfessionalId: string;
}

export interface EmailChangeOutboxPayload {
  verificationTokenId: string;
  professionalId: string;
  professionalName: string;
  newEmail: string;
  decision?: 'APPROVED' | 'REJECTED';
  recipientProfessionalIds: string[];
}

const EMAIL_CHANGE_KINDS: NotificationKind[] = [
  NotificationKind.EMAIL_CHANGE_REQUEST_PENDING,
  NotificationKind.EMAIL_CHANGE_REQUEST_DECIDED,
];

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

export function enqueueEmailChangeOutbox(
  tx: Prisma.TransactionClient,
  organizationId: string,
  kind: NotificationKind,
  payload: EmailChangeOutboxPayload,
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
  EMAIL_CHANGE_REQUEST_PENDING: 'Troca de e-mail aguardando aprovação',
  EMAIL_CHANGE_REQUEST_DECIDED: 'Pedido de troca de e-mail decidido',
};

export const MAX_ATTEMPTS = 5;
const LEASE_MS = 180_000;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 3_600_000;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
  ) {}

  async processPending(
    limit = 20,
  ): Promise<{ processed: number; failed: number }> {
    const now = new Date();
    const pending = await this.prisma.outboxEvent.findMany({
      where: {
        processedAt: null,
        attempts: { lt: MAX_ATTEMPTS },
        nextAttemptAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    let processed = 0;
    let failed = 0;
    for (const event of pending) {
      const attemptId = randomUUID();
      const leased = await this.prisma.outboxEvent.updateMany({
        where: {
          id: event.id,
          processedAt: null,
          OR: [{ leaseUntil: event.leaseUntil }, { leaseUntil: null }],
        },
        data: { leaseUntil: new Date(Date.now() + LEASE_MS), attemptId },
      });
      if (leased.count === 0) continue;

      try {
        await this.materialize(event);
        await this.complete(event, attemptId);
        processed += 1;
      } catch (error) {
        failed += 1;
        await this.scheduleRetry(event, attemptId, error);
      }
    }
    return { processed, failed };
  }

  private async materialize(event: OutboxEvent): Promise<void> {
    if (EMAIL_CHANGE_KINDS.includes(event.kind)) {
      return this.materializeEmailChange(event);
    }

    const payload = event.payload as unknown as OutboxPayload;
    const recipient = await this.prisma.professional.findFirst({
      where: {
        id: payload.recipientProfessionalId,
        organizationId: event.organizationId,
      },
      select: { userId: true, user: { select: { isActive: true } } },
    });
    if (!recipient || !recipient.user.isActive) return;
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId_kind: { userId: recipient.userId, kind: event.kind } },
    });
    if (preference?.enabled === false) return;
    await this.prisma.notification.upsert({
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

  private async materializeEmailChange(event: OutboxEvent): Promise<void> {
    const payload = event.payload as unknown as EmailChangeOutboxPayload;
    const recipients = await this.prisma.professional.findMany({
      where: {
        id: { in: payload.recipientProfessionalIds },
        organizationId: event.organizationId,
      },
      select: { userId: true, user: { select: { isActive: true } } },
    });

    const body =
      event.kind === NotificationKind.EMAIL_CHANGE_REQUEST_PENDING
        ? `${payload.professionalName} pediu a troca do e-mail de acesso para ${payload.newEmail}. Aprove ou recuse o pedido.`
        : payload.decision === 'APPROVED'
          ? `Seu pedido de troca de e-mail para ${payload.newEmail} foi aprovado. Confirme pelo link enviado.`
          : `Seu pedido de troca de e-mail para ${payload.newEmail} foi recusado pela administração.`;

    for (const recipient of recipients) {
      if (!recipient.user.isActive) continue;

      const preference = await this.prisma.notificationPreference.findUnique({
        where: { userId_kind: { userId: recipient.userId, kind: event.kind } },
      });
      if (preference?.enabled === false) continue;

      await this.prisma.notification.upsert({
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
          body,
          entityType: 'VerificationToken',
          entityId: payload.verificationTokenId,
        },
      });
    }
  }

  private async complete(event: OutboxEvent, attemptId: string) {
    const updated = await this.prisma.outboxEvent.updateMany({
      where: { id: event.id, attemptId },
      data: { processedAt: new Date(), leaseUntil: null, lastError: null },
    });
    if (updated.count === 0) {
      this.logger.debug(
        `outbox event ${event.id} reassigned to another worker; completion by attempt ${attemptId} discarded`,
      );
    }
  }

  private async scheduleRetry(
    event: OutboxEvent,
    attemptId: string,
    error: unknown,
  ): Promise<void> {
    const attempts = event.attempts + 1;
    const backoffMs = Math.min(
      BASE_BACKOFF_MS * 2 ** event.attempts,
      MAX_BACKOFF_MS,
    );
    const message = error instanceof Error ? error.message : 'unknown';
    const updated = await this.prisma.outboxEvent.updateMany({
      where: { id: event.id, attemptId },
      data: {
        attempts,
        nextAttemptAt: new Date(Date.now() + backoffMs),
        leaseUntil: null,
        lastError: message.slice(0, 500),
      },
    });
    if (updated.count === 0) {
      this.logger.debug(
        `outbox event ${event.id} reassigned to another worker; retry by attempt ${attemptId} discarded`,
      );
      return;
    }
    if (attempts >= MAX_ATTEMPTS) {
      this.logger.warn(`outbox event ${event.id} dead-lettered: ${message}`);
    }
  }

  async retryOutboxEvent(id: string, user: AuthenticatedUserPayload) {
    const event = await this.prisma.outboxEvent.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!event) throw new NotFoundException();
    if (event.processedAt || event.attempts < MAX_ATTEMPTS) {
      throw new ConflictException(
        'Apenas eventos em falha terminal podem ser reenfileirados.',
      );
    }
    const attemptId = randomUUID();
    const updated = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        organizationId: user.organizationId,
        processedAt: null,
        attempts: { gte: MAX_ATTEMPTS },
      },
      data: {
        attempts: 0,
        nextAttemptAt: new Date(),
        leaseUntil: null,
        attemptId,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'Apenas eventos em falha terminal podem ser reenfileirados.',
      );
    }
    await this.auditLog.record({
      userId: user.id,
      organizationId: user.organizationId,
      entityType: AUDIT_ENTITY_TYPES.OUTBOX_EVENT,
      entityId: id,
      action: AUDIT_ACTIONS.OUTBOX_EVENT_REQUEUED,
      oldValues: { attempts: event.attempts, lastError: event.lastError },
      newValues: { attempts: 0 },
      changedFields: ['attempts', 'nextAttemptAt', 'leaseUntil', 'attemptId'],
    });
    return { requeued: true, id };
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

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CalendarSyncJob,
  GoogleCalendarConnection,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import {
  GoogleApiError,
  GoogleCalendarClient,
  GoogleEvent,
} from './google-calendar.client';
import { GoogleAuthService } from './google-auth.service';
import {
  ALLERVIA_APPOINTMENT_ID_KEY,
  GoogleEventMapperService,
  MappableAppointment,
} from './google-event-mapper.service';
import { enqueueCalendarSync } from './calendar-sync.enqueue';

const LINK_INCLUDE = {
  appointment: {
    include: {
      patient: { select: { fullName: true } },
      organization: { select: { timeZone: true } },
    },
  },
} satisfies Prisma.GoogleCalendarEventLinkInclude;

type LinkWithAppointment = Prisma.GoogleCalendarEventLinkGetPayload<{
  include: typeof LINK_INCLUDE;
}>;

@Injectable()
export class CalendarInboundSyncService {
  private readonly logger = new Logger(CalendarInboundSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GoogleCalendarClient,
    private readonly auth: GoogleAuthService,
    private readonly mapper: GoogleEventMapperService,
    private readonly audit: IAuditLogService,
    private readonly config: ConfigService,
  ) {}

  async processIncremental(job: CalendarSyncJob): Promise<void> {
    const connection = await this.loadConnection(job.connectionId);
    if (!connection) return;
    if (!connection.syncToken) {
      await this.processFullResyncForConnection(connection);
      return;
    }

    const accessToken = await this.auth.getAccessToken(connection);
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

    try {
      do {
        const page = await this.client.listEvents(
          accessToken,
          connection.calendarId,
          {
            syncToken: connection.syncToken,
            pageToken,
            showDeleted: true,
          },
        );
        for (const event of page.items ?? []) {
          await this.handleIncomingEvent(connection, event);
        }
        pageToken = page.nextPageToken;
        nextSyncToken = page.nextSyncToken ?? nextSyncToken;
      } while (pageToken);
    } catch (error) {
      if (error instanceof GoogleApiError && error.isGone) {
        await this.prisma.googleCalendarConnection.update({
          where: { id: connection.id },
          data: { syncToken: null },
        });
        await this.processFullResyncForConnection({
          ...connection,
          syncToken: null,
        });
        return;
      }
      throw error;
    }

    await this.prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: {
        syncToken: nextSyncToken ?? connection.syncToken,
        lastIncrementalSyncAt: new Date(),
      },
    });
  }

  async processFullResync(job: CalendarSyncJob): Promise<void> {
    const connection = await this.loadConnection(job.connectionId);
    if (!connection) return;
    await this.processFullResyncForConnection(connection);
  }

  private async processFullResyncForConnection(
    connection: GoogleCalendarConnection,
  ): Promise<void> {
    const accessToken = await this.auth.getAccessToken(connection);
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    const seenEventIds = new Set<string>();

    do {
      const page = await this.client.listEvents(
        accessToken,
        connection.calendarId,
        { pageToken, showDeleted: true, maxResults: 250 },
      );
      for (const event of page.items ?? []) {
        seenEventIds.add(event.id);
        if (this.appointmentIdOf(event)) {
          await this.handleIncomingEvent(connection, event);
        }
      }
      pageToken = page.nextPageToken;
      nextSyncToken = page.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

    const activeLinks = await this.prisma.googleCalendarEventLink.findMany({
      where: {
        connectionId: connection.id,
        deletedAt: null,
        appointment: { status: 'SCHEDULED' },
      },
      select: {
        id: true,
        appointmentId: true,
        organizationId: true,
        googleEventId: true,
      },
    });
    const orphanedLinks = activeLinks.filter(
      (link) => !seenEventIds.has(link.googleEventId),
    );
    for (const link of orphanedLinks) {
      await this.prisma.googleCalendarEventLink.delete({
        where: { id: link.id },
      });
      await enqueueCalendarSync(this.prisma, {
        organizationId: link.organizationId,
        kind: 'PUSH_SYNC',
        appointmentId: link.appointmentId,
      });
    }

    await this.prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: {
        syncToken: nextSyncToken ?? null,
        lastFullSyncAt: new Date(),
        lastIncrementalSyncAt: new Date(),
      },
    });
  }

  private async handleIncomingEvent(
    connection: GoogleCalendarConnection,
    event: GoogleEvent,
  ): Promise<void> {
    const appointmentId = this.appointmentIdOf(event);
    if (!appointmentId) return;

    const link = await this.prisma.googleCalendarEventLink.findUnique({
      where: { appointmentId },
      include: LINK_INCLUDE,
    });
    if (
      !link ||
      link.connectionId !== connection.id ||
      link.googleEventId !== event.id ||
      link.organizationId !== connection.organizationId
    ) {
      return;
    }
    if (event.etag && link.etag && event.etag === link.etag) return;

    if (event.status === 'cancelled') {
      await this.handleExternalDeletion(connection, link);
      return;
    }

    const startsAt = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : null;
    const endsAt = event.end?.dateTime ? new Date(event.end.dateTime) : null;
    if (
      !startsAt ||
      !endsAt ||
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime())
    ) {
      return;
    }

    const mappable = this.toMappable(link);

    const expected = this.mapper.toEventPayload(mappable);
    const contentDrifted =
      (event.summary !== undefined && event.summary !== expected.summary) ||
      (event.description !== undefined &&
        (event.description ?? '') !== (expected.description ?? ''));
    if (contentDrifted) {
      await this.prisma.googleCalendarEventLink.update({
        where: { id: link.id },
        data: { etag: event.etag ?? link.etag, lastSyncedHash: null },
      });
      await enqueueCalendarSync(this.prisma, {
        organizationId: link.organizationId,
        kind: 'PUSH_SYNC',
        appointmentId: link.appointmentId,
      });
      return;
    }

    const incomingHash = this.mapper.incomingHash(mappable, {
      startsAt,
      endsAt,
      cancelled: false,
    });
    if (incomingHash === link.lastSyncedHash) {
      await this.prisma.googleCalendarEventLink.update({
        where: { id: link.id },
        data: { etag: event.etag ?? link.etag },
      });
      return;
    }

    const systemUserId = this.systemUserId();
    await this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: link.appointmentId },
      });
      if (!appointment) return;

      if (appointment.status !== 'SCHEDULED') {
        await enqueueCalendarSync(tx, {
          organizationId: link.organizationId,
          kind: 'PUSH_SYNC',
          appointmentId: appointment.id,
        });
        return;
      }

      const currentHash = this.mapper.contentHash({
        ...mappable,
        title: appointment.title,
        notes: appointment.notes,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        status: appointment.status,
      });
      if (link.lastSyncedHash && currentHash !== link.lastSyncedHash) {
        await enqueueCalendarSync(tx, {
          organizationId: link.organizationId,
          kind: 'PUSH_SYNC',
          appointmentId: appointment.id,
        });
        return;
      }

      const updated = await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          startsAt,
          endsAt,
          revision: { increment: 1 },
          ...(systemUserId ? { updatedById: systemUserId } : {}),
        },
      });

      if (systemUserId) {
        await this.audit.record(
          {
            userId: systemUserId,
            organizationId: link.organizationId,
            entityType: 'Patient',
            entityId: appointment.patientId,
            action: 'APPOINTMENT_UPDATED_FROM_GOOGLE',
            oldValues: {
              startsAt: appointment.startsAt.toISOString(),
              endsAt: appointment.endsAt.toISOString(),
            },
            newValues: {
              appointmentId: appointment.id,
              startsAt: updated.startsAt.toISOString(),
              endsAt: updated.endsAt.toISOString(),
              googleEventId: event.id,
            },
          },
          tx,
        );
      }

      await tx.googleCalendarEventLink.update({
        where: { id: link.id },
        data: {
          etag: event.etag ?? null,
          lastSyncedHash: this.mapper.incomingHash(
            { ...mappable, startsAt: updated.startsAt, endsAt: updated.endsAt },
            {
              startsAt: updated.startsAt,
              endsAt: updated.endsAt,
              cancelled: false,
            },
          ),
        },
      });
    });
  }

  private async handleExternalDeletion(
    connection: GoogleCalendarConnection,
    link: LinkWithAppointment,
  ): Promise<void> {
    if (link.deletedAt) return;
    if (link.appointment.status !== 'SCHEDULED') {
      await this.prisma.googleCalendarEventLink.update({
        where: { id: link.id },
        data: { deletedAt: new Date() },
      });
      return;
    }

    const systemUserId = this.systemUserId();
    await this.prisma.$transaction(async (tx) => {
      await tx.googleCalendarEventLink.delete({ where: { id: link.id } });
      await enqueueCalendarSync(tx, {
        organizationId: link.organizationId,
        kind: 'PUSH_SYNC',
        appointmentId: link.appointmentId,
      });
      if (systemUserId) {
        await this.audit.record(
          {
            userId: systemUserId,
            organizationId: link.organizationId,
            entityType: 'Patient',
            entityId: link.appointment.patientId,
            action: 'GOOGLE_EVENT_RESTORED',
            newValues: {
              appointmentId: link.appointmentId,
              googleEventId: link.googleEventId,
            },
          },
          tx,
        );
      }
    });
    this.logger.log(
      `event deleted on Google; re-push enqueued for appointment ${link.appointmentId}`,
    );
  }

  private toMappable(link: LinkWithAppointment): MappableAppointment {
    const appointment = link.appointment;
    return {
      id: appointment.id,
      title: appointment.title,
      notes: appointment.notes,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
      patientFirstName:
        appointment.patient.fullName.trim().split(/\s+/)[0] ?? 'Paciente',
      timeZone: appointment.organization.timeZone,
    };
  }

  private appointmentIdOf(event: GoogleEvent): string | null {
    const value =
      event.extendedProperties?.private?.[ALLERVIA_APPOINTMENT_ID_KEY];
    return typeof value === 'string' && value ? value : null;
  }

  private async loadConnection(
    connectionId: string | null,
  ): Promise<GoogleCalendarConnection | null> {
    if (!connectionId) return null;
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection || connection.status !== 'ACTIVE') return null;
    return connection;
  }

  private systemUserId(): string | null {
    return this.config.get<string>('SYSTEM_USER_ID')?.trim() || null;
  }
}

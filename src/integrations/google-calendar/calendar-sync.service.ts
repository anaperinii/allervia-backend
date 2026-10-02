import { Injectable, Logger } from '@nestjs/common';
import {
  CalendarSyncJob,
  GoogleCalendarConnection,
  GoogleCalendarEventLink,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { GoogleApiError, GoogleCalendarClient } from './google-calendar.client';
import { GoogleAuthService } from './google-auth.service';
import {
  GoogleEventMapperService,
  MappableAppointment,
} from './google-event-mapper.service';
import { ChannelLifecycleService } from './channel-lifecycle.service';
import { CalendarInboundSyncService } from './calendar-inbound-sync.service';

export const MAX_ATTEMPTS = 8;
const LEASE_MS = 60_000;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 3_600_000;

const APPOINTMENT_INCLUDE = {
  patient: { select: { fullName: true } },
  organization: { select: { timeZone: true } },
  calendarEventLink: true,
} satisfies Prisma.AppointmentInclude;

type AppointmentForSync = Prisma.AppointmentGetPayload<{
  include: typeof APPOINTMENT_INCLUDE;
}>;

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GoogleCalendarClient,
    private readonly auth: GoogleAuthService,
    private readonly mapper: GoogleEventMapperService,
    private readonly channels: ChannelLifecycleService,
    private readonly inbound: CalendarInboundSyncService,
  ) {}

  async processPending(
    limit = 20,
  ): Promise<{ processed: number; failed: number }> {
    const now = new Date();
    const candidates = await this.prisma.calendarSyncJob.findMany({
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
    for (const job of candidates) {
      const leased = await this.prisma.calendarSyncJob.updateMany({
        where: {
          id: job.id,
          processedAt: null,
          OR: [{ leaseUntil: job.leaseUntil }, { leaseUntil: null }],
        },
        data: { leaseUntil: new Date(Date.now() + LEASE_MS) },
      });
      if (leased.count === 0) continue;

      try {
        await this.dispatch(job);
        await this.prisma.calendarSyncJob.update({
          where: { id: job.id },
          data: { processedAt: new Date(), leaseUntil: null, pendingKey: null },
        });
        processed += 1;
      } catch (error) {
        failed += 1;
        await this.scheduleRetry(job, error);
      }
    }
    return { processed, failed };
  }

  private async dispatch(job: CalendarSyncJob): Promise<void> {
    switch (job.kind) {
      case 'PUSH_SYNC':
        return this.processPush(job);
      case 'PULL_INCREMENTAL':
        return this.inbound.processIncremental(job);
      case 'PULL_FULL_RESYNC':
        return this.inbound.processFullResync(job);
      case 'CHANNEL_RENEW':
        return this.processChannelRenew(job);
      case 'CHANNEL_STOP':
        return Promise.resolve();
    }
  }

  private async processChannelRenew(job: CalendarSyncJob): Promise<void> {
    if (!job.connectionId) return;
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { id: job.connectionId },
    });
    if (!connection || connection.status !== 'ACTIVE') return;
    await this.channels.ensureChannel(connection);
  }

  private async processPush(job: CalendarSyncJob): Promise<void> {
    if (!job.appointmentId) return;
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: job.appointmentId },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment || !appointment.professionalId) return;

    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { professionalId: appointment.professionalId },
    });

    let link = appointment.calendarEventLink;
    if (link && link.connectionId !== connection?.id) {
      await this.deleteOnOldConnection(link);
      await this.prisma.googleCalendarEventLink.delete({
        where: { id: link.id },
      });
      link = null;
    }

    if (!connection || connection.status !== 'ACTIVE') return;

    const mappable = this.toMappable(appointment);
    const hash = this.mapper.contentHash(mappable);
    if (link?.lastSyncedHash === hash) return;

    try {
      if (appointment.status === 'SCHEDULED') {
        await this.upsertEvent(connection, appointment, link, mappable, hash);
      } else if (
        appointment.status === 'CANCELLED' ||
        appointment.status === 'MISSED'
      ) {
        await this.removeEvent(connection, link, hash);
      }
    } catch (error) {
      if (error instanceof GoogleApiError && error.isInvalidGrant) return;
      throw error;
    }
  }

  private async upsertEvent(
    connection: GoogleCalendarConnection,
    appointment: AppointmentForSync,
    link: GoogleCalendarEventLink | null,
    mappable: MappableAppointment,
    hash: string,
  ): Promise<void> {
    const accessToken = await this.auth.getAccessToken(connection);
    const payload = this.mapper.toEventPayload(mappable);

    if (link && !link.deletedAt) {
      try {
        const patched = await this.client.patchEvent(
          accessToken,
          connection.calendarId,
          link.googleEventId,
          payload,
        );
        await this.saveLink(
          appointment,
          connection,
          patched.id,
          patched.etag,
          hash,
        );
        return;
      } catch (error) {
        if (
          !(error instanceof GoogleApiError) ||
          (!error.isNotFound && !error.isGone)
        ) {
          throw error;
        }
      }
    }

    const inserted = await this.client.insertEvent(
      accessToken,
      connection.calendarId,
      payload,
    );
    await this.saveLink(
      appointment,
      connection,
      inserted.id,
      inserted.etag,
      hash,
    );
  }

  private async removeEvent(
    connection: GoogleCalendarConnection,
    link: GoogleCalendarEventLink | null,
    hash: string,
  ): Promise<void> {
    if (!link || link.deletedAt) return;
    const accessToken = await this.auth.getAccessToken(connection);
    try {
      await this.client.deleteEvent(
        accessToken,
        connection.calendarId,
        link.googleEventId,
      );
    } catch (error) {
      if (
        !(error instanceof GoogleApiError) ||
        (!error.isNotFound && !error.isGone)
      ) {
        throw error;
      }
    }
    await this.prisma.googleCalendarEventLink.update({
      where: { id: link.id },
      data: { deletedAt: new Date(), lastSyncedHash: hash, etag: null },
    });
  }

  private async saveLink(
    appointment: AppointmentForSync,
    connection: GoogleCalendarConnection,
    googleEventId: string,
    etag: string | undefined,
    hash: string,
  ): Promise<void> {
    await this.prisma.googleCalendarEventLink.upsert({
      where: { appointmentId: appointment.id },
      create: {
        organizationId: appointment.organizationId,
        appointmentId: appointment.id,
        connectionId: connection.id,
        googleEventId,
        etag: etag ?? null,
        lastSyncedHash: hash,
      },
      update: {
        connectionId: connection.id,
        googleEventId,
        etag: etag ?? null,
        lastSyncedHash: hash,
        deletedAt: null,
      },
    });
  }

  private async deleteOnOldConnection(
    link: GoogleCalendarEventLink,
  ): Promise<void> {
    const oldConnection = await this.prisma.googleCalendarConnection.findUnique(
      { where: { id: link.connectionId } },
    );
    if (!oldConnection || oldConnection.status !== 'ACTIVE' || link.deletedAt) {
      return;
    }
    try {
      const accessToken = await this.auth.getAccessToken(oldConnection);
      await this.client.deleteEvent(
        accessToken,
        oldConnection.calendarId,
        link.googleEventId,
      );
    } catch (error) {
      this.logger.warn(
        `event removal on previous connection failed for link ${link.id}: ${String(error)}`,
      );
    }
  }

  private toMappable(appointment: AppointmentForSync): MappableAppointment {
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

  private async scheduleRetry(
    job: CalendarSyncJob,
    error: unknown,
  ): Promise<void> {
    const attempts = job.attempts + 1;
    const retryAfterMs =
      error instanceof GoogleApiError && error.retryAfterSeconds
        ? error.retryAfterSeconds * 1000
        : null;
    const backoffMs =
      retryAfterMs ??
      Math.min(BASE_BACKOFF_MS * 2 ** job.attempts, MAX_BACKOFF_MS);
    const message = error instanceof Error ? error.message : String(error);
    const deadLettered = attempts >= MAX_ATTEMPTS;
    await this.prisma.calendarSyncJob.update({
      where: { id: job.id },
      data: {
        attempts,
        nextAttemptAt: new Date(Date.now() + backoffMs),
        leaseUntil: null,
        lastError: message.slice(0, 500),
        ...(deadLettered ? { processedAt: new Date(), pendingKey: null } : {}),
      },
    });
    if (deadLettered) {
      this.logger.warn(`calendar sync job ${job.id} dead-lettered: ${message}`);
    }
  }
}

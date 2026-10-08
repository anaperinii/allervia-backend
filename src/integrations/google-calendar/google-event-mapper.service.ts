import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AppointmentStatus } from '@prisma/client';
import { GoogleEventPayload } from './google-calendar.client';

export const ALLERVIA_APPOINTMENT_ID_KEY = 'allerviaAppointmentId';

export interface MappableAppointment {
  id: string;
  title: string | null;
  notes: string | null;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  patientFirstName: string;
  timeZone: string;
}

@Injectable()
export class GoogleEventMapperService {
  toEventPayload(appointment: MappableAppointment): GoogleEventPayload {
    return {
      summary: this.summary(appointment),
      description: appointment.notes ?? '',
      start: {
        dateTime: appointment.startsAt.toISOString(),
        timeZone: appointment.timeZone,
      },
      end: {
        dateTime: appointment.endsAt.toISOString(),
        timeZone: appointment.timeZone,
      },
      visibility: 'private',
      extendedProperties: {
        private: { [ALLERVIA_APPOINTMENT_ID_KEY]: appointment.id },
      },
    };
  }

  contentHash(appointment: MappableAppointment): string {
    return this.hashParts(
      this.summary(appointment),
      appointment.notes ?? '',
      appointment.startsAt.toISOString(),
      appointment.endsAt.toISOString(),
      appointment.status,
    );
  }

  incomingHash(
    appointment: MappableAppointment,
    incoming: { startsAt: Date; endsAt: Date; cancelled: boolean },
  ): string {
    return this.hashParts(
      this.summary(appointment),
      appointment.notes ?? '',
      incoming.startsAt.toISOString(),
      incoming.endsAt.toISOString(),
      incoming.cancelled ? 'CANCELLED' : appointment.status,
    );
  }

  private summary(appointment: MappableAppointment): string {
    if (appointment.title?.trim()) return appointment.title.trim();
    return `Consulta — ${appointment.patientFirstName}`;
  }

  private hashParts(...parts: string[]): string {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  }
}

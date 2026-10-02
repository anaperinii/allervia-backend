import { AppointmentStatus } from '@prisma/client';
import {
  ALLERVIA_APPOINTMENT_ID_KEY,
  GoogleEventMapperService,
  MappableAppointment,
} from './google-event-mapper.service';

describe('GoogleEventMapperService', () => {
  const mapper = new GoogleEventMapperService();

  const base: MappableAppointment = {
    id: 'apt-1',
    title: null,
    notes: 'Aplicar dose 3',
    startsAt: new Date('2026-10-05T13:00:00.000Z'),
    endsAt: new Date('2026-10-05T13:30:00.000Z'),
    status: AppointmentStatus.SCHEDULED,
    patientFirstName: 'Maria',
    timeZone: 'America/Sao_Paulo',
  };

  it('uses first name fallback when there is no title', () => {
    const payload = mapper.toEventPayload(base);
    expect(payload.summary).toBe('Consulta — Maria');
  });

  it('prefers the appointment title when present', () => {
    const payload = mapper.toEventPayload({ ...base, title: '  Retorno  ' });
    expect(payload.summary).toBe('Retorno');
  });

  it('maps times with the organization time zone and private visibility', () => {
    const payload = mapper.toEventPayload(base);
    expect(payload.start).toEqual({
      dateTime: '2026-10-05T13:00:00.000Z',
      timeZone: 'America/Sao_Paulo',
    });
    expect(payload.end?.dateTime).toBe('2026-10-05T13:30:00.000Z');
    expect(payload.visibility).toBe('private');
    expect(payload.extendedProperties?.private).toEqual({
      [ALLERVIA_APPOINTMENT_ID_KEY]: 'apt-1',
    });
  });

  it('copies notes into the description', () => {
    expect(mapper.toEventPayload(base).description).toBe('Aplicar dose 3');
    expect(mapper.toEventPayload({ ...base, notes: null }).description).toBe(
      '',
    );
  });

  it('produces a stable content hash', () => {
    expect(mapper.contentHash(base)).toBe(mapper.contentHash({ ...base }));
  });

  it('changes the hash when synced fields change', () => {
    const reference = mapper.contentHash(base);
    expect(mapper.contentHash({ ...base, notes: 'outro' })).not.toBe(reference);
    expect(
      mapper.contentHash({
        ...base,
        startsAt: new Date('2026-10-05T14:00:00.000Z'),
      }),
    ).not.toBe(reference);
    expect(
      mapper.contentHash({ ...base, status: AppointmentStatus.CANCELLED }),
    ).not.toBe(reference);
  });

  it('matches incomingHash with contentHash for identical state', () => {
    expect(
      mapper.incomingHash(base, {
        startsAt: base.startsAt,
        endsAt: base.endsAt,
        cancelled: false,
      }),
    ).toBe(mapper.contentHash(base));
  });
});

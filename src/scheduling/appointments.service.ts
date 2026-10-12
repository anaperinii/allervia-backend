import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { buildPage, resolvePage } from 'src/infra/http/pagination';
import { enqueueCalendarSync } from 'src/integrations/google-calendar/calendar-sync.enqueue';
import {
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentDto,
} from './dtos/appointment.dto';

const APPOINTMENT_SELECT = {
  id: true,
  organizationId: true,
  patientId: true,
  doseId: true,
  title: true,
  startsAt: true,
  endsAt: true,
  status: true,
  notes: true,
  statusReason: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  professionalId: true,
  patient: { select: { id: true, fullName: true, phoneNumber: true } },
  dose: { select: { id: true, scheduledAt: true, status: true } },
  professional: { select: { id: true, fullName: true, profession: true } },
} satisfies Prisma.AppointmentSelect;

function period(from: string, to: string): { from: Date; to: Date } {
  const parsedFrom = new Date(from);
  const parsedTo = new Date(to);
  if (
    !Number.isFinite(parsedFrom.getTime()) ||
    !Number.isFinite(parsedTo.getTime()) ||
    parsedFrom > parsedTo
  )
    throw new BadRequestException('INVALID_PERIOD');
  return { from: parsedFrom, to: parsedTo };
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IAuditLogService,
    private readonly abilities: AbilityFactory,
  ) {}

  async create(dto: CreateAppointmentDto, user: AuthenticatedUserPayload) {
    const window = period(dto.startsAt, dto.endsAt);
    const ability = this.abilities.createForUser(user);
    return this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.findFirst({
        where: {
          id: dto.patientId,
          organizationId: user.organizationId,
          isArchived: false,
        },
        select: { id: true, isActive: true },
      });
      if (!patient) throw new NotFoundException('PATIENT_NOT_FOUND');

      if (!patient.isActive) throw new ConflictException('PATIENT_INACTIVE');
      if (!dto.professionalId)
        throw new BadRequestException('APPOINTMENT_PROFESSIONAL_REQUIRED');
      const professional = await tx.professional.findFirst({
        where: {
          id: dto.professionalId,
          organizationId: user.organizationId,
        },
        select: { id: true },
      });
      if (!professional)
        throw new NotFoundException('APPOINTMENT_PROFESSIONAL_NOT_FOUND');
      if (dto.doseId) {
        const dose = await tx.dose.findFirst({
          where: {
            id: dto.doseId,
            immunotherapy: { patient: { id: dto.patientId } },
            status: 'SCHEDULED',
            isArchived: false,
          },
          select: { id: true },
        });
        if (!dose) throw new BadRequestException('INVALID_DOSE_LINK');
        const linked = await tx.appointment.findUnique({
          where: { doseId: dto.doseId },
          select: { id: true, status: true },
        });
        if (linked && linked.status === 'SCHEDULED')
          throw new ConflictException('DOSE_ALREADY_SCHEDULED');
        if (linked)
          throw new ConflictException('DOSE_APPOINTMENT_REQUIRES_REVIEW');
      }
      const appointment = await tx.appointment.create({
        data: {
          organizationId: user.organizationId,
          patientId: dto.patientId,
          professionalId: dto.professionalId,
          doseId: dto.doseId ?? null,
          title: dto.title ?? null,
          startsAt: window.from,
          endsAt: window.to,
          notes: dto.notes ?? null,
          createdById: user.id,
          updatedById: user.id,
        },
        select: APPOINTMENT_SELECT,
      });
      const accessible = await tx.appointment.findFirst({
        where: {
          AND: [
            { id: appointment.id },
            accessibleBy(ability, 'create').ofType('Appointment'),
          ],
        },
        select: { id: true },
      });
      if (!accessible)
        throw new ForbiddenException('APPOINTMENT_NOT_ACCESSIBLE');
      await this.audit.record(
        {
          userId: user.id,
          organizationId: user.organizationId,
          entityType: AUDIT_ENTITY_TYPES.APPOINTMENT,
          entityId: appointment.id,
          action: 'APPOINTMENT_CREATED',
          newValues: {
            patientId: dto.patientId,
            doseId: dto.doseId ?? null,
            professionalId: dto.professionalId,
            startsAt: window.from.toISOString(),
            endsAt: window.to.toISOString(),
          },
        },
        tx,
      );
      await enqueueCalendarSync(tx, {
        organizationId: user.organizationId,
        kind: 'PUSH_SYNC',
        appointmentId: appointment.id,
      });
      return appointment;
    });
  }

  async update(
    id: string,
    dto: UpdateAppointmentDto,
    user: AuthenticatedUserPayload,
  ) {
    const ability = this.abilities.createForUser(user);
    if (!ability.can('update', 'Appointment')) throw new NotFoundException();
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findFirst({
        where: {
          AND: [
            { id, organizationId: user.organizationId },
            accessibleBy(ability, 'update').ofType('Appointment'),
          ],
        },
      });
      if (!appointment) throw new NotFoundException();
      if (appointment.revision !== dto.expectedRevision)
        throw new ConflictException('STALE_APPOINTMENT_REVISION');

      const nextStatus = dto.status ?? appointment.status;
      const changingStatus = nextStatus !== appointment.status;
      if (changingStatus) {
        if (appointment.status !== 'SCHEDULED')
          throw new ConflictException('APPOINTMENT_ALREADY_CLOSED');
        if (
          (nextStatus === 'CANCELLED' || nextStatus === 'MISSED') &&
          !dto.statusReason?.trim()
        )
          throw new BadRequestException('STATUS_REASON_REQUIRED');
        if (nextStatus === 'MISSED' && appointment.startsAt > new Date())
          throw new ConflictException('MISS_BEFORE_START');
      }
      const reschedule = dto.startsAt !== undefined || dto.endsAt !== undefined;
      if (reschedule && appointment.status !== 'SCHEDULED')
        throw new ConflictException('APPOINTMENT_ALREADY_CLOSED');
      if (
        dto.professionalId !== undefined &&
        dto.professionalId !== appointment.professionalId
      ) {
        if (appointment.status !== 'SCHEDULED')
          throw new ConflictException('APPOINTMENT_ALREADY_CLOSED');
        const professional = await tx.professional.findFirst({
          where: {
            id: dto.professionalId,
            organizationId: user.organizationId,
          },
          select: { id: true },
        });
        if (!professional)
          throw new NotFoundException('APPOINTMENT_PROFESSIONAL_NOT_FOUND');
      }
      const window = reschedule
        ? period(
            dto.startsAt ?? appointment.startsAt.toISOString(),
            dto.endsAt ?? appointment.endsAt.toISOString(),
          )
        : null;

      const updated = await tx.appointment.update({
        where: { id },
        data: {
          status: nextStatus,
          statusReason: dto.statusReason ?? appointment.statusReason,
          ...(window ? { startsAt: window.from, endsAt: window.to } : {}),
          ...(dto.professionalId !== undefined
            ? { professionalId: dto.professionalId }
            : {}),
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          revision: { increment: 1 },
          updatedById: user.id,
        },
        select: APPOINTMENT_SELECT,
      });
      await this.audit.record(
        {
          userId: user.id,
          organizationId: user.organizationId,
          entityType: AUDIT_ENTITY_TYPES.APPOINTMENT,
          entityId: id,
          action: 'APPOINTMENT_UPDATED',
          oldValues: {
            status: appointment.status,
            statusReason: appointment.statusReason,
            startsAt: appointment.startsAt.toISOString(),
            professionalId: appointment.professionalId,
          },
          newValues: {
            patientId: appointment.patientId,
            status: nextStatus,

            statusReason: updated.statusReason,
            startsAt: updated.startsAt.toISOString(),
            professionalId: updated.professionalId,
          },
        },
        tx,
      );
      if (updated.professionalId || appointment.professionalId) {
        await enqueueCalendarSync(tx, {
          organizationId: user.organizationId,
          kind: 'PUSH_SYNC',
          appointmentId: id,
        });
      }
      return updated;
    });
  }

  async applyExternalReschedule(
    tx: Prisma.TransactionClient,
    appointmentId: string,
    window: { startsAt: Date; endsAt: Date },
    actorUserId: string,
    source: { googleEventId: string },
  ) {
    if (
      !Number.isFinite(window.startsAt.getTime()) ||
      !Number.isFinite(window.endsAt.getTime()) ||
      window.startsAt >= window.endsAt
    ) {
      throw new BadRequestException('INVALID_PERIOD');
    }
    if (!actorUserId) {
      throw new Error(
        'SYSTEM_USER_ID ausente: reagendamento externo exige ator na trilha',
      );
    }

    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) return null;
    if (appointment.status !== 'SCHEDULED') {
      throw new ConflictException('APPOINTMENT_ALREADY_CLOSED');
    }

    const updated = await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        revision: { increment: 1 },
        updatedById: actorUserId,
      },
    });

    await this.audit.record(
      {
        userId: actorUserId,
        organizationId: appointment.organizationId,
        entityType: AUDIT_ENTITY_TYPES.APPOINTMENT,
        entityId: appointment.id,
        action: 'APPOINTMENT_UPDATED_FROM_GOOGLE',
        oldValues: {
          startsAt: appointment.startsAt.toISOString(),
          endsAt: appointment.endsAt.toISOString(),
        },
        newValues: {
          patientId: appointment.patientId,
          startsAt: updated.startsAt.toISOString(),
          endsAt: updated.endsAt.toISOString(),
          googleEventId: source.googleEventId,
        },
      },
      tx,
    );

    return updated;
  }

  async list(query: ListAppointmentsQueryDto, user: AuthenticatedUserPayload) {
    const ability = this.abilities.createForUser(user);
    const bounds = resolvePage(query);
    if (!ability.can('read', 'Appointment')) return buildPage([], 0, bounds);
    const window = period(query.from, query.to);
    const where: Prisma.AppointmentWhereInput = {
      AND: [
        { organizationId: user.organizationId },
        accessibleBy(ability, 'read').ofType('Appointment'),
        { startsAt: { gte: window.from, lte: window.to } },
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.patientId ? [{ patientId: query.patientId }] : []),
        ...(query.professionalId
          ? [{ professionalId: query.professionalId }]
          : []),
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        select: APPOINTMENT_SELECT,
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        skip: bounds.skip,
        take: bounds.take,
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return buildPage(items, total, bounds);
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { buildPage, resolvePage } from 'src/infra/http/pagination';
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
  patient: { select: { id: true, fullName: true, phoneNumber: true } },
  dose: { select: { id: true, scheduledAt: true, status: true } },
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
      await this.audit.record(
        {
          userId: user.id,
          organizationId: user.organizationId,
          entityType: 'Patient',
          entityId: dto.patientId,
          action: 'APPOINTMENT_CREATED',
          newValues: {
            appointmentId: appointment.id,
            doseId: dto.doseId ?? null,
            startsAt: window.from.toISOString(),
            endsAt: window.to.toISOString(),
          },
        },
        tx,
      );
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
          entityType: 'Patient',
          entityId: appointment.patientId,
          action: 'APPOINTMENT_UPDATED',
          oldValues: {
            status: appointment.status,
            startsAt: appointment.startsAt.toISOString(),
          },
          newValues: {
            appointmentId: id,
            status: nextStatus,
            statusReason: dto.statusReason ?? null,
            startsAt: updated.startsAt.toISOString(),
          },
        },
        tx,
      );
      return updated;
    });
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

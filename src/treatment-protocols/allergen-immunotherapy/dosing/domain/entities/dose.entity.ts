import { DoseStatus } from '@prisma/client';
import { DoseAlreadyArchivedException } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/exceptions/dose-already-archived.exception';
import { UpdateDoseData } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/interfaces/doses.interface';
import { UpdateDoseStatusDto } from 'src/treatment-protocols/allergen-immunotherapy/dosing/dtos/update-dose-status.dto';
import { InvalidDoseStatusException } from 'src/treatment-protocols/allergen-immunotherapy/dosing/domain/exceptions/invalid-dose-status.exception';

export interface DoseProps {
  id: string;
  concentration: number;
  volume: number;
  scheduledAt: Date;
  administeredAt: Date | null;
  nextIntervalInDays: number;
  betweenDosesReport: string;
  status: DoseStatus;
  isArchived: boolean;
  immunotherapyId: string;
  administeredById: string | null;
  createdById: string;
  updatedById: string;
  archivedById: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDoseProps {
  concentration: number;
  volume: number;
  scheduledAt: Date;
  administeredAt?: Date | null;
  nextIntervalInDays: number;
  betweenDosesReport?: string;
  immunotherapyId: string;
  administeredById?: string | null;
  createdById: string;
  updatedById: string;
}

export class Dose {
  id: string;
  concentration: number;
  volume: number;
  scheduledAt: Date;
  administeredAt: Date | null;
  nextIntervalInDays: number;
  betweenDosesReport: string;
  status: DoseStatus;
  isArchived: boolean;
  immunotherapyId: string;
  administeredById: string | null;
  createdById: string;
  updatedById: string;
  archivedById: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: DoseProps) {
    this.id = props.id;
    this.concentration = props.concentration;
    this.volume = props.volume;
    this.scheduledAt = props.scheduledAt;
    this.administeredAt = props.administeredAt;
    this.nextIntervalInDays = props.nextIntervalInDays;
    this.betweenDosesReport = props.betweenDosesReport;
    this.status = props.status;
    this.isArchived = props.isArchived;
    this.immunotherapyId = props.immunotherapyId;
    this.administeredById = props.administeredById;
    this.createdById = props.createdById;
    this.updatedById = props.updatedById;
    this.archivedById = props.archivedById;
    this.archivedAt = props.archivedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static createNew(props: CreateDoseProps) {
    return {
      concentration: props.concentration,
      volume: props.volume,
      scheduledAt: props.scheduledAt,
      administeredAt: props.administeredAt || null,
      nextIntervalInDays: props.nextIntervalInDays,
      betweenDosesReport: props.betweenDosesReport ?? '',
      status: DoseStatus.SCHEDULED,
      immunotherapyId: props.immunotherapyId,
      administeredById: props.administeredById || null,
      createdById: props.createdById,
      updatedById: props.updatedById,
      isArchived: false,
    };
  }

  administered(props: Partial<UpdateDoseData>): void {
    const administeredAt = props.administeredAt ?? this.administeredAt;
    if (administeredAt && this.status === 'SCHEDULED') {
      const administeredDate = new Date(administeredAt);
      const scheduledDate = new Date(this.scheduledAt);

      // Comparar strings de data no formato YYYY-MM-DD para evitar problemas de timezone
      const administeredDateStr = administeredDate.toISOString().split('T')[0];
      const scheduledDateStr = scheduledDate.toISOString().split('T')[0];

      const isSameDate = administeredDateStr === scheduledDateStr;

      if (isSameDate) {
        this.status = 'ADMINISTERED_ON_SCHEDULE';
      } else {
        this.status = 'ADMINISTERED_OFF_SCHEDULE';
      }
    }
  }

  changeStatus(props: UpdateDoseStatusDto): void {
    const newStatus = props.status;

    // Verificar se o status atual começa com 'ADMINISTERED' (pode ser ON_SCHEDULE ou OFF_SCHEDULE)
    if (String(this.status).startsWith('ADMINISTERED') && newStatus !== 'ENTERED_IN_ERROR') {
      throw new InvalidDoseStatusException(
        'Doses administradas podem ser alteradas apenas para registro errôneo',
      );
    }

    if (this.status === 'ENTERED_IN_ERROR') {
      throw new InvalidDoseStatusException(
        'Doses registradas erroneamente e arquivadas não podem ter status alterado',
      );
    }

    if (this.status === 'SCHEDULED' && newStatus === 'ENTERED_IN_ERROR') {
      throw new InvalidDoseStatusException(
        'Doses agendadas não podem ser marcadas como registros errôneos, caso seja necessário, edite os dados diretamente.',
      );
    }

    // Verificar se o status atual começa com 'ADMINISTERED' (pode ser ON_SCHEDULE ou OFF_SCHEDULE)
    if (String(this.status).startsWith('ADMINISTERED') && newStatus === 'ENTERED_IN_ERROR') {
      this.status = newStatus;
      this.archive();
      return;
    }

    if (props.status === this.status) {
      throw new InvalidDoseStatusException(`Esta dose já possui o status ${props.status}`);
    }

    this.status = newStatus;
  }

  archive(): void {
    if (this.isArchived) {
      throw new DoseAlreadyArchivedException();
    }
    this.isArchived = true;
  }
}

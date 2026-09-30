import { BadRequestException } from '@nestjs/common';
import { normalizeCpf } from './cpf';

export const LEGAL_AGE_IN_YEARS = 18;

export interface GuardianInput {
  fullName: string;
  cpf?: string | null;
  phoneNumber: string;
}

export interface GuardianColumns {
  guardianName: string | null;
  guardianCpf: string | null;
  guardianPhoneNumber: string | null;
}

export function isMinor(
  birthDate: Date,
  reference: Date = new Date(),
): boolean {
  const eighteenth = new Date(birthDate);
  eighteenth.setFullYear(eighteenth.getFullYear() + LEGAL_AGE_IN_YEARS);
  return reference < eighteenth;
}

export function guardianColumns(
  guardian: GuardianInput | null | undefined,
  birthDate: Date,
  reference: Date = new Date(),
): GuardianColumns {
  const minor = isMinor(birthDate, reference);

  if (minor && !guardian)
    throw new BadRequestException('GUARDIAN_REQUIRED_FOR_MINOR');
  if (!minor && guardian)
    throw new BadRequestException('GUARDIAN_NOT_ALLOWED_FOR_ADULT');

  if (!guardian)
    return {
      guardianName: null,
      guardianCpf: null,
      guardianPhoneNumber: null,
    };

  return {
    guardianName: guardian.fullName.trim(),
    guardianCpf: normalizeCpf(guardian.cpf),
    guardianPhoneNumber: guardian.phoneNumber,
  };
}

export function guardianFromColumns(
  columns: GuardianColumns,
): (GuardianInput & { cpf: string | null }) | null {
  if (!columns.guardianName || !columns.guardianPhoneNumber) return null;
  return {
    fullName: columns.guardianName,
    cpf: columns.guardianCpf,
    phoneNumber: columns.guardianPhoneNumber,
  };
}

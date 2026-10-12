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

export function todayCivilDate(
  timeZone: string,
  now: Date = new Date(),
): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

export function birthCivilDate(birthDate: Date): string {
  return birthDate.toISOString().slice(0, 10);
}

export function isMinor(birthDate: Date, todayCivil: string): boolean {
  const birth = birthCivilDate(birthDate);
  const eighteenthBirthday = `${Number(birth.slice(0, 4)) + LEGAL_AGE_IN_YEARS}${birth.slice(4)}`;
  return todayCivil < eighteenthBirthday;
}

export function guardianColumns(
  guardian: GuardianInput | null | undefined,
  birthDate: Date,
  todayCivil: string,
): GuardianColumns {
  const minor = isMinor(birthDate, todayCivil);

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

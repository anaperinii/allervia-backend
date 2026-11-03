import { validateSync } from 'class-validator';
import {
  CreatePatientDto,
  MAX_PATIENT_AGE_YEARS,
} from './create-patient.dto';

function dayOffsetFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function yearOffsetFromToday(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function birthDateErrors(birthDate: unknown): string[] {
  const dto = new CreatePatientDto();
  dto.fullName = 'Paciente sintético';
  dto.birthDate = birthDate as string;
  dto.weightInKg = 70;
  dto.phoneNumber = '11999999999';
  dto.responsiblePhysicianId = 'professional-1';

  return validateSync(dto)
    .filter((error) => error.property === 'birthDate')
    .flatMap((error) => Object.keys(error.constraints ?? {}));
}

describe('Data de nascimento do paciente (RNE-024)', () => {
  it('aceita uma data no passado dentro do limite de idade', () => {
    expect(birthDateErrors('1990-01-01')).toHaveLength(0);
  });

  it('aceita o dia de hoje', () => {
    expect(birthDateErrors(dayOffsetFromToday(0))).toHaveLength(0);
  });

  it('rejeita data futura', () => {
    expect(birthDateErrors(dayOffsetFromToday(1))).toContain('birthDate');
    expect(birthDateErrors(yearOffsetFromToday(1))).toContain('birthDate');
  });

  it(`rejeita data anterior a ${MAX_PATIENT_AGE_YEARS} anos`, () => {
    expect(
      birthDateErrors(yearOffsetFromToday(-MAX_PATIENT_AGE_YEARS - 1)),
    ).toContain('birthDate');
  });

  it(`aceita a borda de ${MAX_PATIENT_AGE_YEARS} anos menos um dia`, () => {
    const edge = new Date();
    edge.setFullYear(edge.getFullYear() - MAX_PATIENT_AGE_YEARS);
    edge.setDate(edge.getDate() + 1);
    expect(birthDateErrors(edge.toISOString().slice(0, 10))).toHaveLength(0);
  });
});

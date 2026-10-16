import { BadRequestException } from '@nestjs/common';
import {
  birthCivilDate,
  guardianColumns,
  isMinor,
  todayCivilDate,
} from './guardian';

describe('todayCivilDate', () => {
  const instant = new Date('2026-10-09T12:00:00Z');

  it('resolve a data civil no fuso da organização', () => {
    expect(todayCivilDate('America/Sao_Paulo', instant)).toBe('2026-10-09');
  });

  it('avança o dia em fuso extremo a leste', () => {
    expect(todayCivilDate('Pacific/Kiritimati', instant)).toBe('2026-10-10');
  });

  it('mantém o dia anterior em fuso extremo a oeste', () => {
    expect(todayCivilDate('Pacific/Niue', instant)).toBe('2026-10-09');
    expect(
      todayCivilDate('Pacific/Niue', new Date('2026-10-09T10:00:00Z')),
    ).toBe('2026-10-08');
  });
});

describe('birthCivilDate', () => {
  it('extrai a parte YYYY-MM-DD do birthDate armazenado em meia-noite UTC', () => {
    expect(birthCivilDate(new Date('2008-10-11T00:00:00.000Z'))).toBe(
      '2008-10-11',
    );
  });
});

describe('isMinor', () => {
  const birthDate = new Date('2008-10-11T00:00:00.000Z');

  it('é menor na véspera do 18º aniversário', () => {
    expect(isMinor(birthDate, '2026-10-10')).toBe(true);
  });

  it('é maior no dia exato do 18º aniversário', () => {
    expect(isMinor(birthDate, '2026-10-11')).toBe(false);
  });

  it('é maior após o aniversário', () => {
    expect(isMinor(birthDate, '2026-10-12')).toBe(false);
  });

  it('mantém casos não-limítrofes inalterados', () => {
    expect(isMinor(new Date('1990-01-01T00:00:00.000Z'), '2026-10-10')).toBe(
      false,
    );
    expect(isMinor(new Date('2020-05-05T00:00:00.000Z'), '2026-10-10')).toBe(
      true,
    );
  });

  it('nascido em 29 de fevereiro completa a maioridade em 1º de março de ano não bissexto', () => {
    const leapBirth = new Date('2008-02-29T00:00:00.000Z');
    expect(isMinor(leapBirth, '2026-02-28')).toBe(true);
    expect(isMinor(leapBirth, '2026-03-01')).toBe(false);
  });

  it('o resultado no limiar depende apenas da data civil do fuso informado', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    const east = todayCivilDate('Pacific/Kiritimati', now);
    const west = todayCivilDate('Pacific/Niue', now);
    expect(isMinor(birthDate, east)).toBe(false);
    expect(isMinor(birthDate, west)).toBe(true);
  });
});

describe('guardianColumns', () => {
  const minorBirth = new Date('2010-06-15T00:00:00.000Z');
  const adultBirth = new Date('1990-06-15T00:00:00.000Z');
  const today = '2026-10-10';
  const guardian = {
    fullName: ' Maria Silva ',
    cpf: null,
    phoneNumber: '62999999999',
  };

  it('exige responsável para menor', () => {
    expect(() => guardianColumns(null, minorBirth, today)).toThrow(
      BadRequestException,
    );
    expect(() => guardianColumns(null, minorBirth, today)).toThrow(
      'GUARDIAN_REQUIRED_FOR_MINOR',
    );
  });

  it('rejeita responsável para maior', () => {
    expect(() => guardianColumns(guardian, adultBirth, today)).toThrow(
      'GUARDIAN_NOT_ALLOWED_FOR_ADULT',
    );
  });

  it('normaliza as colunas do responsável do menor', () => {
    expect(guardianColumns(guardian, minorBirth, today)).toEqual({
      guardianName: 'Maria Silva',
      guardianCpf: null,
      guardianPhoneNumber: '62999999999',
    });
  });

  it('zera as colunas para maior sem responsável', () => {
    expect(guardianColumns(null, adultBirth, today)).toEqual({
      guardianName: null,
      guardianCpf: null,
      guardianPhoneNumber: null,
    });
  });
});

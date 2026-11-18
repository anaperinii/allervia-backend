import { validateSync } from 'class-validator';
import * as bcrypt from 'bcrypt';
import {
  IsPassword,
  PASSWORD_MAX_BYTES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isPasswordWithinPolicy,
} from './password.validation';
import { BcryptPasswordHashingService } from '../bcrypt-password-hashing.service';

class PasswordDto {
  @IsPassword()
  password: string;
}

function errorsFor(password: unknown): string[] {
  const dto = new PasswordDto();
  dto.password = password as string;
  return validateSync(dto).flatMap((error) =>
    Object.keys(error.constraints ?? {}),
  );
}

const VALID_PASSWORD = 'Senha!Forte2026';

describe('IsPassword (política única de senha — DEC-05)', () => {
  it('aceita senha que cumpre todos os requisitos', () => {
    expect(errorsFor(VALID_PASSWORD)).toHaveLength(0);
  });

  it('rejeita vazio e abaixo do mínimo', () => {
    expect(errorsFor('')).toContain('isNotEmpty');
    expect(
      errorsFor('Ab1!'.repeat(2).slice(0, PASSWORD_MIN_LENGTH - 1)),
    ).toContain('minLength');
  });

  it('rejeita acima do máximo de caracteres', () => {
    expect(errorsFor('A'.repeat(PASSWORD_MAX_LENGTH + 1) + 'a1!')).toContain(
      'maxLength',
    );
  });

  it('aceita o mínimo e o máximo de caracteres', () => {
    expect(errorsFor('Ab1!'.repeat(2))).toHaveLength(0);
    expect(errorsFor('Ab1!'.repeat(PASSWORD_MAX_LENGTH / 4))).toHaveLength(0);
  });

  it('rejeita sem letra maiúscula', () => {
    expect(errorsFor('senha!forte2026')).toContain('matches');
  });

  it('rejeita sem letra minúscula', () => {
    expect(errorsFor('SENHA!FORTE2026')).toContain('matches');
  });

  it('rejeita sem número', () => {
    expect(errorsFor('Senha!Forte')).toContain('matches');
  });

  it('rejeita sem caractere especial', () => {
    expect(errorsFor('SenhaForte2026')).toContain('matches');
  });

  it('rejeita 73 bytes ASCII mesmo dentro do limite de caracteres', () => {
    expect(isPasswordWithinPolicy('a'.repeat(PASSWORD_MAX_BYTES + 1))).toBe(
      false,
    );
  });

  it('rejeita não-string', () => {
    expect(errorsFor(12345678)).toContain('isString');
  });

  it('fecha a equivalência silenciosa do bcrypt: prefixo de 72 bytes igual', () => {
    const prefix = 'a'.repeat(PASSWORD_MAX_BYTES);
    const longer = prefix + 'different';

    const legacyHash = bcrypt.hashSync(prefix, 4);
    expect(bcrypt.compareSync(longer, legacyHash)).toBe(true);

    expect(isPasswordWithinPolicy(longer)).toBe(false);
  });
});

describe('BcryptPasswordHashingService (backstop e compatibilidade legada)', () => {
  const service = new BcryptPasswordHashingService();

  it('rejeita hash de senha acima de 72 bytes fora da borda HTTP', async () => {
    await expect(
      service.hash('a'.repeat(PASSWORD_MAX_BYTES + 1)),
    ).rejects.toThrow(/72 bytes/);
  });

  it('continua verificando hashes legados de senhas longas (login preservado)', async () => {
    const legacyPassword = 'x'.repeat(100);
    const legacyHash = bcrypt.hashSync(legacyPassword, 4);
    await expect(service.compare(legacyPassword, legacyHash)).resolves.toBe(
      true,
    );
    await expect(
      service.compare('senha-completamente-diferente', legacyHash),
    ).resolves.toBe(false);
  });
});

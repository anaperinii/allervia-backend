import { validateSync } from 'class-validator';
import * as bcrypt from 'bcrypt';
import {
  IsPassword,
  PASSWORD_MAX_BYTES,
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

describe('IsPassword (política única de senha — DEC-05)', () => {
  it('rejeita vazio e abaixo do mínimo', () => {
    expect(errorsFor('')).toContain('isNotEmpty');
    expect(errorsFor('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toContain(
      'minLength',
    );
  });

  it('aceita o mínimo e o limite exato de 72 bytes ASCII', () => {
    expect(errorsFor('a'.repeat(PASSWORD_MIN_LENGTH))).toHaveLength(0);
    expect(errorsFor('a'.repeat(PASSWORD_MAX_BYTES))).toHaveLength(0);
  });

  it('rejeita 73 bytes ASCII', () => {
    expect(errorsFor('a'.repeat(PASSWORD_MAX_BYTES + 1))).toContain(
      'maxByteLength',
    );
  });

  it('conta bytes, não caracteres, para Unicode multibyte', () => {
    const twoBytesEach = 'á'.repeat(36);
    expect(errorsFor(twoBytesEach)).toHaveLength(0);
    const overByOneChar = 'á'.repeat(37);
    expect(errorsFor(overByOneChar)).toContain('maxByteLength');
  });

  it('rejeita não-string', () => {
    expect(errorsFor(12345678)).toContain('isString');
  });

  it('fecha a equivalência silenciosa do bcrypt: prefixo de 72 bytes igual', () => {
    const prefix = 'a'.repeat(PASSWORD_MAX_BYTES);
    const longer = prefix + 'different';

    const legacyHash = bcrypt.hashSync(prefix, 4);
    expect(bcrypt.compareSync(longer, legacyHash)).toBe(true);

    expect(isPasswordWithinPolicy(prefix)).toBe(true);
    expect(isPasswordWithinPolicy(longer)).toBe(false);
    expect(errorsFor(longer)).toContain('maxByteLength');
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

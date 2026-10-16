import { applyDecorators } from '@nestjs/common';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
  buildMessage,
} from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_MAX_LENGTH = 20;

export const PASSWORD_MAX_BYTES = 72;

const UPPERCASE_PATTERN = /[A-Z]/;
const LOWERCASE_PATTERN = /[a-z]/;
const DIGIT_PATTERN = /\d/;
const SPECIAL_CHAR_PATTERN = /[^A-Za-z0-9]/;

export function isPasswordWithinPolicy(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH &&
    Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES &&
    UPPERCASE_PATTERN.test(value) &&
    LOWERCASE_PATTERN.test(value) &&
    DIGIT_PATTERN.test(value) &&
    SPECIAL_CHAR_PATTERN.test(value)
  );
}

function MaxByteLength(maxBytes: number): PropertyDecorator {
  return ValidateBy({
    name: 'maxByteLength',
    constraints: [maxBytes],
    validator: {
      validate: (value): boolean =>
        typeof value === 'string' &&
        Buffer.byteLength(value, 'utf8') <= maxBytes,
      defaultMessage: buildMessage(
        (eachPrefix) =>
          `${eachPrefix}A senha deve ter no máximo ${maxBytes} bytes (caracteres acentuados ocupam mais de um byte)`,
      ),
    },
  });
}

export function IsPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    IsNotEmpty({ message: 'A senha não pode estar vazia' }),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres`,
    }),
    MaxLength(PASSWORD_MAX_LENGTH, {
      message: `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres`,
    }),
    Matches(UPPERCASE_PATTERN, {
      message: 'A senha deve conter ao menos uma letra maiúscula',
    }),
    Matches(LOWERCASE_PATTERN, {
      message: 'A senha deve conter ao menos uma letra minúscula',
    }),
    Matches(DIGIT_PATTERN, {
      message: 'A senha deve conter ao menos um número',
    }),
    Matches(SPECIAL_CHAR_PATTERN, {
      message: 'A senha deve conter ao menos um caractere especial',
    }),
    MaxByteLength(PASSWORD_MAX_BYTES),
  );
}

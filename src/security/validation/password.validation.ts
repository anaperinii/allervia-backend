import { applyDecorators } from '@nestjs/common';
import {
  IsNotEmpty,
  IsString,
  MinLength,
  ValidateBy,
  buildMessage,
} from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_MAX_BYTES = 72;

export function isPasswordWithinPolicy(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.length >= PASSWORD_MIN_LENGTH &&
    Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES
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
    MaxByteLength(PASSWORD_MAX_BYTES),
  );
}

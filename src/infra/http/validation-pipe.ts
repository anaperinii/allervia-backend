import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { CodedHttpException } from 'src/infra/exceptions/coded.exception';

function collect(
  errors: ValidationError[],
  prefix = '',
): Record<string, string[]> {
  return errors.reduce<Record<string, string[]>>((accumulator, error) => {
    const path = prefix ? `${prefix}.${error.property}` : error.property;

    if (error.constraints) {
      accumulator[path] = Object.values(error.constraints);
    }

    if (error.children?.length) {
      Object.assign(accumulator, collect(error.children, path));
    }

    return accumulator;
  }, {});
}

/**
 * Validação de entrada com erros por campo no envelope público. Campos
 * desconhecidos são rejeitados: o cliente não concede papel nem organização
 * enviando propriedades extras.
 */
export function buildValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new CodedHttpException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Requisição inválida.',
        collect(errors),
      ),
  });
}

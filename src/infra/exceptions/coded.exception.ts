import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';

export interface CodedExceptionPayload {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Exceções com código estável de erro. Elas mantêm a hierarquia do Nest — um
 * 401 continua sendo `UnauthorizedException` — e apenas acrescentam o `code`
 * que a UI usa para ramificar sem depender do texto traduzido.
 */
export class CodedHttpException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(
      { code, message, fieldErrors } satisfies CodedExceptionPayload,
      status,
    );
  }
}

export class CodedUnauthorizedException extends UnauthorizedException {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super({ code, message } satisfies CodedExceptionPayload);
  }
}

export class CodedForbiddenException extends ForbiddenException {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super({ code, message } satisfies CodedExceptionPayload);
  }
}

export class CodedTooManyRequestsException extends CodedHttpException {
  constructor(code: string, message: string) {
    super(HttpStatus.TOO_MANY_REQUESTS, code, message);
  }
}

import { HttpStatus } from '@nestjs/common';

export abstract class DomainException extends Error {
  readonly status: HttpStatus;

  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    Error.captureStackTrace(this, this.constructor);
  }
}


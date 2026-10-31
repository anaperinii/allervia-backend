import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IPasswordHashingService } from './interfaces/password-hashing.service.interface';
import { PASSWORD_MAX_BYTES } from './validation/password.validation';

@Injectable()
export class BcryptPasswordHashingService extends IPasswordHashingService {
  private readonly SALT_ROUNDS = 10;

  async hash(password: string): Promise<string> {
    if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
      throw new Error(
        `Senha excede ${PASSWORD_MAX_BYTES} bytes; rejeitada antes do bcrypt`,
      );
    }
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

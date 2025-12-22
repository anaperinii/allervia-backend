import { Injectable } from '@nestjs/common';
import { IHashingService } from '../../domain/contracts/hashing.service.interface';
import * as bcrypt from 'bcrypt';

@Injectable()
export class BcryptService extends IHashingService {
    private readonly SALT_ROUNDS = 10;

    async hash(password: string): Promise<string> {
        return await bcrypt.hash(password, this.SALT_ROUNDS);
    }

    async compare(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }
}

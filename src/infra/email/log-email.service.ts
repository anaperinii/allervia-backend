import { Injectable, Logger } from '@nestjs/common';
import { IEmailService } from './email.service';

@Injectable()
export class LogEmailService extends IEmailService {
  private readonly logger = new Logger('EmailService');

  sendPasswordResetLink(email: string, token: string): Promise<void> {
    this.logger.log(
      `[DEV] Redefinição de senha para ${email} — token=${token}`,
    );
    return Promise.resolve();
  }

  sendPasswordChangedNotification(email: string): Promise<void> {
    this.logger.log(`[DEV] Senha alterada — aviso enviado para ${email}`);
    return Promise.resolve();
  }
}

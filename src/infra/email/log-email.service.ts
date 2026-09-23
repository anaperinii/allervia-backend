import { Injectable, Logger } from '@nestjs/common';
import { IEmailService, InviteEmailParams } from './email.service';

/**
 * Transporte de desenvolvimento. Ele imprime o token porque não há caixa de
 * entrada para consultar; por isso é recusado em produção.
 */
@Injectable()
export class LogEmailService extends IEmailService {
  sendDemoRequest(): Promise<void> {
    // Never mark a durable job delivered through the development logger.
    return Promise.reject(new Error('SMTP_REQUIRED'));
  }

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

  sendInviteLink(params: InviteEmailParams): Promise<void> {
    this.logger.log(
      `[DEV] Convite para ${params.email} em ${params.organizationName} — token=${params.token}`,
    );
    return Promise.resolve();
  }
}

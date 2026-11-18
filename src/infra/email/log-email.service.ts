import { Injectable, Logger } from '@nestjs/common';
import {
  DemoConfirmationEmailParams,
  EmailChangeLinkParams,
  IEmailService,
  InviteEmailParams,
} from './email.service';

@Injectable()
export class LogEmailService extends IEmailService {
  sendDemoRequest(): Promise<void> {
    return Promise.reject(new Error('SMTP_REQUIRED'));
  }

  private readonly logger = new Logger('EmailService');

  sendDemoRequestConfirmation(
    params: DemoConfirmationEmailParams,
  ): Promise<void> {
    this.logger.log(
      `[DEV] Confirmação de demonstração enviada para ${params.email}`,
    );
    return Promise.resolve();
  }

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

  sendEmailChangeLink(params: EmailChangeLinkParams): Promise<void> {
    this.logger.log(
      `[DEV] Troca de e-mail para ${params.email} → ${params.newEmail} — token=${params.token}`,
    );
    return Promise.resolve();
  }

  sendEmailChangeFarewell(
    previousEmail: string,
    newEmail: string,
  ): Promise<void> {
    this.logger.log(
      `[DEV] Aviso de troca de e-mail enviado para ${previousEmail} — novo endereço ${newEmail}`,
    );
    return Promise.resolve();
  }

  sendEmailChangeWelcome(newEmail: string): Promise<void> {
    this.logger.log(`[DEV] Boas-vindas ao novo e-mail ${newEmail}`);
    return Promise.resolve();
  }

  sendInviteLink(params: InviteEmailParams): Promise<void> {
    this.logger.log(
      `[DEV] Convite para ${params.email} em ${params.organizationName} — token=${params.token}`,
    );
    return Promise.resolve();
  }
}

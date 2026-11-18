import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmailService } from 'src/infra/email/email.service';
import type { EmailChangeChannel } from './dtos/request-email-change.dto';
import { buildWhatsappLink } from './whatsapp-link.util';

export interface EmailChangeDispatchParams {
  channel: EmailChangeChannel;
  token: string;
  fullName: string;
  currentEmail: string;
  newEmail: string;
  phoneNumber: string;
}

@Injectable()
export class EmailChangeDispatcherService {
  private readonly logger = new Logger(EmailChangeDispatcherService.name);

  constructor(
    private readonly emailService: IEmailService,
    private readonly config: ConfigService,
  ) {}

  async dispatch(
    params: EmailChangeDispatchParams,
  ): Promise<string | undefined> {
    const link = this.buildConfirmationLink(params.token);

    if (params.channel === 'whatsapp') {
      return buildWhatsappLink(
        params.phoneNumber,
        [
          `Olá, ${params.fullName}.`,
          `Confirme a troca do seu e-mail de acesso ao Allervia para ${params.newEmail}:`,
          link,
          'O link expira em 60 minutos e vale uma única vez.',
        ].join('\n'),
      );
    }

    try {
      await this.emailService.sendEmailChangeLink({
        email: params.newEmail,
        fullName: params.fullName,
        newEmail: params.newEmail,
        token: params.token,
      });
    } catch {
      this.logger.error('Falha ao enviar o link de troca de e-mail.');
    }

    return undefined;
  }

  private buildConfirmationLink(token: string): string {
    const base = (
      this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:5173'
    ).replace(/\/+$/, '');

    return `${base}/confirm-email-change?token=${encodeURIComponent(token)}`;
  }
}

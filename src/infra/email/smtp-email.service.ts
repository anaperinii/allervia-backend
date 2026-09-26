import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import {
  DemoEmailParams,
  IEmailService,
  InviteEmailParams,
} from './email.service';

@Injectable()
export class SmtpEmailService extends IEmailService implements OnModuleDestroy {
  private readonly logger = new Logger('EmailService');
  private readonly transporter: Transporter;
  private readonly sender: string;
  private readonly appBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    super();

    const host = this.require('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');

    this.sender = this.require('EMAIL_FROM');
    this.appBaseUrl = this.require('APP_BASE_URL').replace(/\/+$/, '');

    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

  async sendDemoRequest(params: DemoEmailParams): Promise<void> {
    const roles: Record<string, string> = {
      doctor: 'Médico(a)',
      clinic_manager: 'Gestor(a) de clínica',
      pharmacist: 'Farmacêutico(a)',
      nurse: 'Enfermeiro(a)',
      other: 'Outro',
    };
    const solutions: Record<string, string> = {
      self: 'Uso próprio',
      single_clinic: 'Uma clínica',
      clinic_network: 'Rede de clínicas',
    };
    const result = await this.transporter.sendMail({
      from: this.sender,
      to: params.to,
      replyTo: params.email,
      messageId: `<demo-${params.id}@allervia.local>`,
      subject: 'Nova solicitação de demonstração — Allervia',
      text: [
        'Uma solicitação de demonstração foi registrada no Allervia.',
        '',
        `Protocolo: ${params.id}`,
        `Nome: ${params.name} ${params.lastName}`,
        `E-mail: ${params.email}`,
        `Telefone: ${params.phone}`,
        `Atuação: ${roles[params.role] ?? params.role}`,
        `Uso pretendido: ${solutions[params.solution] ?? params.solution}`,
        `Especialidade: ${params.specialty}`,
        `Número de profissionais: ${params.professionals}`,
        '',
        'Responda a este e-mail para entrar em contato com a pessoa interessada.',
      ].join('\n'),
    });
    if (result.rejected?.length || !result.accepted?.length) {
      throw new Error('SMTP_RECIPIENT_REJECTED');
    }
  }

  async sendPasswordResetLink(email: string, token: string): Promise<void> {
    const link = `${this.appBaseUrl}/forgot-password?token=${encodeURIComponent(token)}`;

    await this.transporter.sendMail({
      from: this.sender,
      to: email,
      subject: 'Redefinição de senha — Allervia',
      text: [
        'Recebemos um pedido de redefinição de senha para a sua conta Allervia.',
        '',
        `Abra o endereço abaixo para definir uma nova senha:`,
        link,
        '',
        'O link expira em 10 minutos e vale uma única vez.',
        'Se você não pediu a redefinição, ignore esta mensagem.',
      ].join('\n'),
    });

    this.logger.log('Password reset link dispatched.');
  }

  async sendInviteLink(params: InviteEmailParams): Promise<void> {
    const link = `${this.appBaseUrl}/register?token=${encodeURIComponent(params.token)}`;
    const deadline = params.expiresAt.toLocaleDateString('pt-BR');

    await this.transporter.sendMail({
      from: this.sender,
      to: params.email,
      subject: `Convite para ${params.organizationName} — Allervia`,
      text: [
        `Olá, ${params.fullName}.`,
        '',
        `Você foi convidado(a) para acessar o Allervia em ${params.organizationName}.`,
        '',
        'Abra o endereço abaixo para criar sua conta:',
        link,
        '',
        `O convite é válido até ${deadline} e vale uma única vez.`,
      ].join('\n'),
    });

    this.logger.log('Invite link dispatched.');
  }

  async sendPasswordChangedNotification(email: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.sender,
      to: email,
      subject: 'Sua senha do Allervia foi alterada',
      text: [
        'A senha da sua conta Allervia foi alterada.',
        '',
        'As sessões abertas em outros dispositivos foram encerradas.',
        'Se não foi você, procure a administração da sua organização.',
      ].join('\n'),
    });

    this.logger.log('Password change notification dispatched.');
  }

  async onModuleDestroy(): Promise<void> {
    this.transporter.close();
    return Promise.resolve();
  }

  private require(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(
        `${key} is required when EMAIL_TRANSPORT=smtp. Configure the mail provider or use the log transport outside production.`,
      );
    }
    return value;
  }
}

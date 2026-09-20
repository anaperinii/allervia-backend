export interface InviteEmailParams {
  email: string;
  fullName: string;
  organizationName: string;
  token: string;
  expiresAt: Date;
}

export abstract class IEmailService {
  abstract sendPasswordResetLink(email: string, token: string): Promise<void>;

  abstract sendPasswordChangedNotification(email: string): Promise<void>;

  /** Entrega o convite ao destinatário; o token não volta para quem convidou. */
  abstract sendInviteLink(params: InviteEmailParams): Promise<void>;
}

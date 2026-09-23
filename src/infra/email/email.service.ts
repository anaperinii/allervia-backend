export interface DemoEmailParams {
  id: string;
  to: string;
  name: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  solution: string;
  specialty: string;
  professionals: number;
}

export interface InviteEmailParams {
  email: string;
  fullName: string;
  organizationName: string;
  token: string;
  expiresAt: Date;
}

export abstract class IEmailService {
  abstract sendDemoRequest(params: DemoEmailParams): Promise<void>;

  abstract sendPasswordResetLink(email: string, token: string): Promise<void>;

  abstract sendPasswordChangedNotification(email: string): Promise<void>;

  /** Entrega o convite ao destinatário; o token não volta para quem convidou. */
  abstract sendInviteLink(params: InviteEmailParams): Promise<void>;
}

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

export interface DemoConfirmationEmailParams {
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

export interface EmailChangeLinkParams {
  email: string;
  fullName: string;
  newEmail: string;
  token: string;
}

export abstract class IEmailService {
  abstract sendDemoRequest(params: DemoEmailParams): Promise<void>;

  abstract sendDemoRequestConfirmation(
    params: DemoConfirmationEmailParams,
  ): Promise<void>;

  abstract sendPasswordResetLink(email: string, token: string): Promise<void>;

  abstract sendPasswordChangedNotification(email: string): Promise<void>;

  abstract sendInviteLink(params: InviteEmailParams): Promise<void>;

  abstract sendEmailChangeLink(params: EmailChangeLinkParams): Promise<void>;

  abstract sendEmailChangeFarewell(
    previousEmail: string,
    newEmail: string,
  ): Promise<void>;

  abstract sendEmailChangeWelcome(newEmail: string): Promise<void>;
}

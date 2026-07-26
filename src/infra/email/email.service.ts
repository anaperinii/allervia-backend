export abstract class IEmailService {
  abstract sendPasswordResetLink(email: string, token: string): Promise<void>;
  
  abstract sendPasswordChangedNotification(email: string): Promise<void>;
}

import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { SmtpEmailService } from './smtp-email.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('SMTP demo notification', () => {
  const sendMail = jest.fn<
    Promise<{ accepted: string[]; rejected: string[] }>,
    [{ text: string }]
  >();
  let service: SmtpEmailService;
  beforeEach(() => {
    jest.mocked(createTransport).mockReturnValue({
      sendMail,
      close: jest.fn(),
    } as unknown as Transporter);
    sendMail
      .mockReset()
      .mockResolvedValue({ accepted: ['team@example.com'], rejected: [] });
    service = new SmtpEmailService(
      new ConfigService({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'test',
        SMTP_PASSWORD: 'test',
        EMAIL_FROM: 'Allervia <sender@example.com>',
        APP_BASE_URL: 'http://localhost:5173',
      }),
    );
  });
  const input = {
    id: 'synthetic-id',
    to: 'team@example.com',
    name: 'Nome',
    lastName: 'Teste',
    email: 'visitor@example.com',
    phone: '11999999999',
    role: 'doctor',
    solution: 'single_clinic',
    specialty: 'Alergologia',
    professionals: 2,
  };
  it('requires TLS and uses the visitor only as reply-to, never as the sender', async () => {
    await service.sendDemoRequest(input);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ requireTLS: true, secure: false }),
    );
    const sent = sendMail.mock.calls[0][0] as { text: string };
    expect(sent.text).toContain('Especialidade: Alergologia');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Allervia <sender@example.com>',
        to: 'team@example.com',
        replyTo: 'visitor@example.com',
        messageId: '<demo-synthetic-id@allervia.local>',
      }),
    );
  });
  it('does not acknowledge a rejected recipient as accepted', async () => {
    sendMail.mockResolvedValue({
      accepted: [],
      rejected: ['team@example.com'],
    });
    await expect(service.sendDemoRequest(input)).rejects.toThrow(
      'SMTP_RECIPIENT_REJECTED',
    );
  });
});

import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from 'src/infra/database/prisma.service';
import { CodedTooManyRequestsException } from 'src/infra/exceptions/coded.exception';
import { IEmailService } from 'src/infra/email/email.service';
import { DemoRequestDto } from './demo-request.dto';

@Injectable()
export class DemoRequestsService {
  private readonly logger = new Logger(DemoRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: IEmailService,
  ) {}

  async create(input: DemoRequestDto, ip: string) {
    if (!this.config.get<string>('DEMO_REQUEST_EMAIL_TO')) {
      throw new ServiceUnavailableException(
        'O recebimento de demonstrações está temporariamente indisponível.',
      );
    }
    const data = { ...input, email: input.email.toLowerCase() };
    const sourceHash = createHash('sha256').update(`demo:${ip}`).digest('hex');
    const { response, isNew } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73120545)`;
      const previous = await tx.demoRequest.findUnique({
        where: { requestId: input.requestId },
      });
      if (previous) {
        if (
          Object.entries(data).some(
            ([key, value]) => previous[key as keyof typeof previous] !== value,
          )
        ) {
          throw new ConflictException(
            'Essa solicitação já foi usada com outros dados. Recarregue a página.',
          );
        }
        return {
          response: {
            received: true,
            id: previous.id,
            createdAt: previous.createdAt,
          },
          isNew: false,
        };
      }
      const sinceHour = new Date(Date.now() - 3_600_000);
      const [byIp, byEmail, daily] = await Promise.all([
        tx.demoRequest.count({
          where: { sourceHash, createdAt: { gte: sinceHour } },
        }),
        tx.demoRequest.count({
          where: { email: data.email, createdAt: { gte: sinceHour } },
        }),
        tx.demoRequest.count({
          where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } },
        }),
      ]);
      if (byIp >= 10 || byEmail >= 3 || daily >= 100) {
        throw new CodedTooManyRequestsException(
          'DEMO_REQUEST_LIMIT',
          'Muitas solicitações. Aguarde antes de tentar novamente.',
        );
      }
      const saved = await tx.demoRequest.create({
        data: { ...data, sourceHash },
      });
      return {
        response: { received: true, id: saved.id, createdAt: saved.createdAt },
        isNew: true,
      };
    });

    if (isNew) {
      try {
        await this.emailService.sendDemoRequestConfirmation(data);
      } catch {
        this.logger.error(
          'Falha ao enviar e-mail de confirmação de demonstração.',
        );
      }
    }

    return response;
  }
}

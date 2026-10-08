import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from 'src/infra/database/prisma.service';
import { CodedTooManyRequestsException } from 'src/infra/exceptions/coded.exception';
import { DemoRequestDto } from './demo-request.dto';

@Injectable()
export class DemoRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(input: DemoRequestDto, ip: string) {
    if (!this.config.get<string>('DEMO_REQUEST_EMAIL_TO')) {
      throw new ServiceUnavailableException(
        'O recebimento de demonstrações está temporariamente indisponível.',
      );
    }
    const data = { ...input, email: input.email.toLowerCase() };
    const sourceHash = createHash('sha256').update(`demo:${ip}`).digest('hex');
    return this.prisma.$transaction(async (tx) => {
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
          received: true,
          id: previous.id,
          createdAt: previous.createdAt,
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
      return { received: true, id: saved.id, createdAt: saved.createdAt };
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

@Injectable()
export class PublicRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createContactRequest(input: {
    name: string;
    email: string;
    organization?: string;
    message: string;
  }) {
    const request = await this.prisma.contactRequest.create({
      data: {
        name: input.name,
        email: input.email,
        organization: input.organization ?? null,
        message: input.message,
      },
      select: { id: true, status: true, createdAt: true },
    });
    return { received: true, ...request };
  }

  async createSupportRequest(
    input: { subject: string; message: string },
    user: AuthenticatedUserPayload,
  ) {
    const request = await this.prisma.supportRequest.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        subject: input.subject,
        message: input.message,
      },
      select: { id: true, status: true, createdAt: true },
    });
    return { received: true, ...request };
  }

  async listSupportRequests(user: AuthenticatedUserPayload) {
    return this.prisma.supportRequest.findMany({
      where: { organizationId: user.organizationId, userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        subject: true,
        message: true,
        status: true,
        createdAt: true,
      },
    });
  }
}

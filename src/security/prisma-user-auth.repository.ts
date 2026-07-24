import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import {
  IUserAuthRepository,
  UserForAuth,
} from './interfaces/user-auth.repository.interface';

@Injectable()
export class PrismaUserAuthRepository extends IUserAuthRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByEmailForAuth(email: string): Promise<UserForAuth | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        professional: {
          include: {
            professionalRoles: { where: { revokedAt: null } },
          },
        },
        patient: true,
      },
    });

    if (!user) {
      return null;
    }

    const organizationId =
      user.professional?.organizationId ?? user.patient?.organizationId ?? null;

    return {
      id: user.id,
      email: user.email,
      password: user.password,
      type: user.type,
      organizationId,
      professionalId: user.professional?.id ?? null,
      roles: user.professional?.professionalRoles.map((pr) => pr.role) ?? [],
    };
  }
}

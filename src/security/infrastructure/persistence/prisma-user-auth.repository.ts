import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { IUserAuthRepository, UserForAuth } from '../../domain/repositories/user-auth.repository.interface';

@Injectable()
export class PrismaUserAuthRepository extends IUserAuthRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByEmailForAuth(email: string): Promise<UserForAuth | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: { include: { role: true } },
        memberships: { include: { organization: true } },
        organization: true,
        professional: true
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      password: user.password,
      type: user.type,
      organizationId: user.organizationId,
      roles: user.roles.map(r => ({
        roleTag: r.roleTag,
        name: r.role.name,
      })),
      memberships: user.memberships.map(m => ({
        organizationId: m.organizationId,
        organization: { name: m.organization.name },
      })),
      organization: user.organization ? { name: user.organization.name } : undefined,
      professional: user.professional ? { id: user.professional.id } : undefined,
    };
  }
}


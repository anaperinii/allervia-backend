import { Injectable } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';

/// Tipos de alérgeno realmente presentes no acervo visível ao usuário. Serve
/// ao filtro da listagem: oferecer um tipo sem tratamento devolveria vazio.
@Injectable()
export class ListImmunotherapyTypesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(currentUser: AuthenticatedUserPayload): Promise<string[]> {
    const ability = this.abilityFactory.createForUser(currentUser);
    const scope = accessibleBy(ability, 'read').ofType('Immunotherapy');

    const where: Prisma.ImmunotherapyWhereInput = {
      AND: [scope, { isArchived: false }],
    };

    const rows = await this.prisma.immunotherapy.findMany({
      where,
      distinct: ['immunoType'],
      orderBy: { immunoType: 'asc' },
      select: { immunoType: true },
    });

    return rows.map((row) => row.immunoType);
  }
}

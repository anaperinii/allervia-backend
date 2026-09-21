import { Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { AuditLog } from '@prisma/client';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import {
  AuditAction,
  AuditEntityType,
  AuditLogQuery,
} from 'src/infra/audit/audit.types';
import { AbilityFactory } from 'src/security/permissions/ability/ability.factory';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ListAuditLogsDto } from 'src/audit/dtos/list-audit-logs.dto';

@Injectable()
export class ListAuditLogsUseCase {
  constructor(
    private readonly auditLog: IAuditLogService,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async execute(
    dto: ListAuditLogsDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<AuditLog[]> {
    const ability = this.abilityFactory.createForUser(currentUser);
    // Sem regra alguma o CASL devolve `{OR: []}` e o Prisma o ignora dentro de
    // AND; o pre-check impede que a ausência de permissão vire acesso total.
    if (!ability.can('read', 'AuditLog')) throw new NotFoundException();
    const where = accessibleBy(ability, 'read').ofType('AuditLog');

    const query: AuditLogQuery = {
      entityType: dto.entityType as AuditEntityType | undefined,
      entityId: dto.entityId,
      userId: dto.userId,
      action: dto.action as AuditAction | undefined,
      from: dto.from,
      to: dto.to,
      limit: dto.limit,
      cursor: dto.cursor,
    };

    return this.auditLog.findMany(query, where);
  }
}

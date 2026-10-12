import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { accessibleBy } from '@casl/prisma';
import { AuditLog } from '@prisma/client';
import { CodedHttpException } from 'src/infra/exceptions/coded.exception';
import { messageForCode } from 'src/infra/errors/error-catalog';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import {
  AUDIT_ENTITY_TYPES,
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
    if (!ability.can('read', 'AuditLog')) throw new NotFoundException();
    const where = accessibleBy(ability, 'read').ofType('AuditLog');

    if (
      dto.entityType !== undefined &&
      !Object.values(AUDIT_ENTITY_TYPES).includes(
        dto.entityType as AuditEntityType,
      )
    ) {
      throw new CodedHttpException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        messageForCode('VALIDATION_ERROR')!,
        {
          entityType: [
            `Tipo desconhecido. Use um de: ${Object.values(AUDIT_ENTITY_TYPES).join(', ')}`,
          ],
        },
      );
    }

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

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/security/decorators/current-user.decorator';
import { CheckPolicies } from 'src/security/permissions/ability/check-policies.decorator';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ListAuditLogsDto } from './dtos/list-audit-logs.dto';
import { ListAuditLogsUseCase } from './use-cases/list-audit-logs.use-case';

@ApiTags('audit-logs')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly listAuditLogsUseCase: ListAuditLogsUseCase) {}

  @Get()
  @CheckPolicies({ action: 'read', subject: 'AuditLog' })
  async list(
    @Query() dto: ListAuditLogsDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.listAuditLogsUseCase.execute(dto, currentUser);
  }

  @Get('entity/:entityType/:entityId')
  @CheckPolicies({ action: 'read', subject: 'AuditLog' })
  async listByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query() dto: ListAuditLogsDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.listAuditLogsUseCase.execute(
      { ...dto, entityType, entityId },
      currentUser,
    );
  }

  @Get('actor/:userId')
  @CheckPolicies({ action: 'read', subject: 'AuditLog' })
  async listByActor(
    @Param('userId') userId: string,
    @Query() dto: ListAuditLogsDto,
    @CurrentUser() currentUser: AuthenticatedUserPayload,
  ) {
    return this.listAuditLogsUseCase.execute({ ...dto, userId }, currentUser);
  }
}

import { Module } from '@nestjs/common';
import { AuditModule } from 'src/infra/audit/audit.module';
import { PermissionsModule } from 'src/security/permissions/permissions.module';
import { AuditController } from './audit.controller';
import { ListAuditLogsUseCase } from './use-cases/list-audit-logs.use-case';

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [AuditController],
  providers: [ListAuditLogsUseCase],
})
export class AuditTrailModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { IAuditLogService } from './audit-log.service';
import { PrismaAuditLogService } from './prisma-audit-log.service';

@Module({
  imports: [PrismaModule],
  providers: [{ provide: IAuditLogService, useClass: PrismaAuditLogService }],
  exports: [IAuditLogService],
})
export class AuditModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { AuditModule } from 'src/infra/audit/audit.module';
import { PermissionsModule } from 'src/security/permissions/permissions.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [PrismaModule, AuditModule, PermissionsModule],
  providers: [AppointmentsService],
  controllers: [AppointmentsController],
})
export class SchedulingModule {}

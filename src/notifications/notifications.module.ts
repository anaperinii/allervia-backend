import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { RetentionModule } from 'src/infra/retention/retention.module';
import { AuditModule } from 'src/infra/audit/audit.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsDispatcher } from './notifications.dispatcher';

@Module({
  imports: [PrismaModule, AuditModule, RetentionModule],
  providers: [NotificationsService, NotificationsDispatcher],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}

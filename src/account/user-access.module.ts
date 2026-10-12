import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { SessionModule } from 'src/security/session/session.module';
import { UserAccessService } from './user-access.service';

@Module({
  imports: [PrismaModule, SessionModule],
  providers: [UserAccessService],
  exports: [UserAccessService],
})
export class UserAccessModule {}

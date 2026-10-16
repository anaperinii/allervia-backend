import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { RetentionService } from './retention.service';

@Module({
  imports: [PrismaModule],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}

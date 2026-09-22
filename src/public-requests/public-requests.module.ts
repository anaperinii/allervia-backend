import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { PublicRequestsController } from './public-requests.controller';
import { PublicRequestsService } from './public-requests.service';

@Module({
  imports: [PrismaModule],
  providers: [PublicRequestsService],
  controllers: [PublicRequestsController],
})
export class PublicRequestsModule {}

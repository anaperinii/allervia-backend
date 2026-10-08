import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { PublicRequestsController } from './public-requests.controller';
import { PublicRequestsService } from './public-requests.service';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from 'src/infra/email/email.module';
import { DemoRequestsService } from './demo-requests.service';
import { DemoEmailDispatcher } from './demo-email.dispatcher';

@Module({
  imports: [PrismaModule, ConfigModule, EmailModule],
  providers: [PublicRequestsService, DemoRequestsService, DemoEmailDispatcher],
  controllers: [PublicRequestsController],
})
export class PublicRequestsModule {}

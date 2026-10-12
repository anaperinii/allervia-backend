import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { RateLimitConfig } from './rate-limit.config';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [RateLimitConfig, RateLimitService, RateLimitGuard],
  exports: [RateLimitConfig, RateLimitService, RateLimitGuard],
})
export class RateLimitModule {}

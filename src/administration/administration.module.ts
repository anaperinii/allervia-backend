import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AccountModule } from 'src/account/account.module';
import { AdministrationController } from './presentation/controllers/administration.controller';

@Module({
  imports: [PrismaModule, AccountModule],
  providers: [
  ],
  controllers: [AdministrationController],
  exports: [],
})
export class AdministrationModule {}

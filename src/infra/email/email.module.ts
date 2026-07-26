import { Module } from '@nestjs/common';
import { IEmailService } from './email.service';
import { LogEmailService } from './log-email.service';

@Module({
  providers: [{ provide: IEmailService, useClass: LogEmailService }],
  exports: [IEmailService],
})
export class EmailModule {}

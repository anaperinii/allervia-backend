import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IEmailService } from './email.service';
import { LogEmailService } from './log-email.service';
import { SmtpEmailService } from './smtp-email.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: IEmailService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): IEmailService => {
        const transport =
          config.get<string>('EMAIL_TRANSPORT') ??
          (config.get<string>('NODE_ENV') === 'production' ? 'smtp' : 'log');

        if (transport === 'smtp') {
          return new SmtpEmailService(config);
        }

        if (config.get<string>('NODE_ENV') === 'production') {
          throw new Error(
            'EMAIL_TRANSPORT=log is not acceptable in production: configure a real mail provider.',
          );
        }

        return new LogEmailService();
      },
    },
  ],
  exports: [IEmailService],
})
export class EmailModule {}

import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  EMAIL_CHANGE_CHANNELS,
  type EmailChangeChannel,
} from './request-email-change.dto';

export class ApproveEmailChangeDto {
  @ApiProperty({ enum: EMAIL_CHANGE_CHANNELS })
  @IsIn(EMAIL_CHANGE_CHANNELS)
  channel: EmailChangeChannel;
}

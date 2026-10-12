import { ApiProperty } from '@nestjs/swagger';
import { ContactRequestStatus } from '@prisma/client';

export class ContactRequestReceiptDto {
  @ApiProperty({ example: true })
  received: boolean;

  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ContactRequestStatus })
  status: ContactRequestStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class SupportRequestReceiptDto extends ContactRequestReceiptDto {}

export class SupportRequestListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  subject: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ enum: ContactRequestStatus })
  status: ContactRequestStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

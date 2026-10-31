import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty } from 'class-validator';

export const EMAIL_CHANGE_CHANNELS = ['email', 'whatsapp'] as const;

export type EmailChangeChannel = (typeof EMAIL_CHANGE_CHANNELS)[number];

export class AdminRequestEmailChangeDto {
  @ApiProperty({ example: 'novo.endereco@clinica.com.br' })
  @IsNotEmpty({ message: 'O email não pode estar vazio' })
  @IsEmail()
  newEmail: string;

  @ApiProperty({ enum: EMAIL_CHANGE_CHANNELS })
  @IsIn(EMAIL_CHANGE_CHANNELS)
  channel: EmailChangeChannel;
}

export class SelfRequestEmailChangeDto {
  @ApiProperty({ example: 'novo.endereco@clinica.com.br' })
  @IsNotEmpty({ message: 'O email não pode estar vazio' })
  @IsEmail()
  newEmail: string;
}

export const EMAIL_CHANGE_STATUSES = [
  'PENDING',
  'DISPATCHED',
  'CONFIRMED',
  'REJECTED',
  'SUPERSEDED',
  'EXPIRED',
] as const;

export type EmailChangeStatus = (typeof EMAIL_CHANGE_STATUSES)[number];

export class EmailChangeRequestDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  professionalId: string;

  @ApiProperty()
  professionalName: string;

  @ApiProperty()
  currentEmail: string;

  @ApiProperty()
  newEmail: string;

  @ApiProperty({ enum: EMAIL_CHANGE_STATUSES })
  status: EmailChangeStatus;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  requestedAt: Date;

  @ApiPropertyOptional({
    type: Date,
    nullable: true,
    description:
      'Momento em que o pedido foi encerrado: aprovação confirmada, recusa ou substituição.',
  })
  decidedAt?: Date | null;

  @ApiPropertyOptional({
    description:
      'URL wa.me pronta para envio manual quando o canal escolhido é WhatsApp.',
  })
  whatsappUrl?: string;
}

export class EmailChangeRequestPageDto {
  @ApiProperty({ type: [EmailChangeRequestDto] })
  items: EmailChangeRequestDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  total: number;

  @ApiProperty({
    description:
      'Total de pedidos aguardando decisão, independente da página consultada.',
  })
  pending: number;
}

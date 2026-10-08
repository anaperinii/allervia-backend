import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const SUPPORTED_TIME_ZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Bahia',
  'America/Cuiaba',
  'America/Campo_Grande',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
  'America/Noronha',
] as const;

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ description: 'Nome exibido da organização' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @ApiPropertyOptional({
    description: 'Fuso clínico (IANA) adotado por novas prescrições',
    enum: SUPPORTED_TIME_ZONES,
  })
  @IsOptional()
  @IsIn(SUPPORTED_TIME_ZONES)
  timeZone?: string;
}

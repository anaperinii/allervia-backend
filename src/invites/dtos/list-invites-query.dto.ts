import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';
import { PageQueryDto } from 'src/infra/http/pagination';

export class ListInvitesQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Apenas convites ainda abertos' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  onlyActive?: boolean;

  @ApiPropertyOptional({ description: 'Inclui convites expirados' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeExpired?: boolean;

  @ApiPropertyOptional({ description: 'Busca por nome ou e-mail' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;
}

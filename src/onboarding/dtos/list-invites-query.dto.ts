import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { RoleType } from '@prisma/client';

export class ListInvitesQueryDto {
  @IsOptional()
  @IsEnum(RoleType)
  roleType?: RoleType;

  @IsOptional()
  @Transform(({ value }) => value === 'false')
  @IsBoolean()
  onlyActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  includeExpired?: boolean;
}
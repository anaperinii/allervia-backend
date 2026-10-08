import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Profession, Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { PageQueryDto } from 'src/infra/http/pagination';

export class TeamMemberDto {
  @ApiProperty({ description: 'Identificador do profissional' })
  professionalId: string;

  @ApiProperty({ description: 'Identificador da conta de acesso' })
  userId: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty({ enum: Profession })
  profession: Profession;

  @ApiProperty({ nullable: true })
  councilNumber: string | null;

  @ApiProperty({ nullable: true })
  councilUf: string | null;

  @ApiProperty({
    enum: Role,
    isArray: true,
    description: 'Papéis concedidos e ainda vigentes',
  })
  roles: Role[];

  @ApiProperty({ description: 'A conta pode entrar no sistema' })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class ListTeamQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome ou e-mail' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: Profession })
  @IsOptional()
  @IsEnum(Profession)
  profession?: Profession;

  @ApiPropertyOptional({ description: 'Filtra por contas ativas ou inativas' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOwnProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Número do conselho profissional' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  councilNumber?: string;

  @ApiPropertyOptional({ description: 'UF do conselho profissional' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  councilUf?: string;
}

export class UpdateTeamMemberDto extends UpdateOwnProfileDto {
  @ApiPropertyOptional({ enum: Profession })
  @IsOptional()
  @IsEnum(Profession, { message: 'Profissão inválida' })
  profession?: Profession;
}

export class UpdateMemberAccessDto {
  @ApiProperty({ description: 'Habilita ou encerra o acesso da conta' })
  @IsBoolean()
  isActive: boolean;
}

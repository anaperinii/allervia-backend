import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdministrationRoute } from '@prisma/client';
import { Type } from 'class-transformer';
import { CreatePatientDto } from 'src/patients/dtos/create-patient.dto';

export class CreateImmunotherapyDto {
  @ApiPropertyOptional({
    description:
      'Dados do paciente novo. Exatamente um entre patient e patientId.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePatientDto)
  patient?: CreatePatientDto;

  @ApiPropertyOptional({
    description:
      'Paciente já cadastrado que recebe um novo tratamento, sem duplicá-lo.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  patientId?: string;

  @ApiProperty({
    description:
      'Chave de idempotência da intenção confirmada; reenvio com a mesma chave e corpo devolve o resultado original.',
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
  @ApiProperty() @IsString() @IsNotEmpty() immunoType: string;
  @ApiProperty({ enum: AdministrationRoute })
  @IsEnum(AdministrationRoute)
  administrationRoute: AdministrationRoute;
  @ApiProperty() @IsString() @IsNotEmpty() extract: string;
  @ApiProperty({ description: 'ISO timestamp with explicit offset' })
  @IsDateString()
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  inductionStartDate: string;
  @ApiPropertyOptional({
    description:
      'Published version; omitted uses the organizational default once',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  protocolVersionId?: string;
  @ApiProperty()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  stepIds: string[];
  @ApiProperty() @IsString() @IsNotEmpty() startingStepId: string;
  @ApiProperty() @IsString() @IsNotEmpty() targetStepId: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class PdfAuditDto {
  @ApiProperty({
    type: [String],
    description: 'Seções incluídas no PDF gerado no navegador',
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  sections: string[];

  @ApiPropertyOptional({
    description: 'Se os identificadores do paciente foram mascarados no PDF',
  })
  @IsOptional()
  @IsBoolean()
  anonymized?: boolean;
}

export class PdfAuditResponseDto {
  @ApiProperty() recorded: boolean;
}

import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class DemoRequestDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') requestId: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;
  @ApiProperty() @Transform(trim) @IsEmail() @MaxLength(320) email: string;
  @ApiProperty({ example: '11999999999' })
  @IsString()
  @Matches(/^\d{10,11}$/)
  phone: string;
  @ApiProperty({
    enum: ['doctor', 'clinic_manager', 'pharmacist', 'nurse', 'other'],
  })
  @IsIn(['doctor', 'clinic_manager', 'pharmacist', 'nurse', 'other'])
  role: string;
  @ApiProperty({ enum: ['self', 'single_clinic', 'clinic_network'] })
  @IsIn(['self', 'single_clinic', 'clinic_network'])
  solution: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  specialty: string;
  @ApiProperty({ minimum: 1, maximum: 9999 })
  @IsInt()
  @Min(1)
  @Max(9999)
  professionals: number;
}

export class DemoRequestReceiptDto {
  @ApiProperty({ example: true }) received: boolean;
  @ApiProperty() id: string;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
}

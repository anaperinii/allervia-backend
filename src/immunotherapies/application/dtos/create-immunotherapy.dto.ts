import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "@nestjs/class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { AdministrationRoute } from "@prisma/client";
import { Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { CreatePatientDto } from "src/patients/application/dtos/create-patient.dto";

export class CreateImmunotherapyDto {
    @ApiProperty({description: 'Informações do Paciente'})
    @ValidateNested()
    @Type(() => CreatePatientDto)
    patient: CreatePatientDto;

    @ApiProperty({description: 'Tipo Imunoterapia'})
    @IsString()
    @IsNotEmpty()
    immunoType: string;

    @ApiProperty({description: 'Rota de Administração'})
    @IsNotEmpty()
    @IsEnum(AdministrationRoute)
    administrationRoute: AdministrationRoute;

    @ApiProperty({description: 'Extrato'})
    @IsString()
    @IsNotEmpty()
    extract: string;

    @ApiProperty({description: 'Data de Ínicio Indução'})
    @IsDateString({strict: true})
    @IsNotEmpty()    
    inductionStartDate: Date;

    @ApiProperty({description: 'Concentração Meta'})
    @IsString()
    @IsNotEmpty()
    targetConcentration: string;

    @ApiProperty({description: 'Volume Meta'})
    @IsNumber()
    @IsNotEmpty()
    @Min(0.01, { message: 'Volume meta deve ser maior que zero' })
    targetVolume: number;

    @ApiProperty({description: 'ID Médico Responsável'})
    @IsNotEmpty()
    @IsString()
    responsiblePhysicianId: string;
}


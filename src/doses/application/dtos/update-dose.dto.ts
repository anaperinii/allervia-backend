import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsDateString, IsOptional } from 'class-validator';

export class UpdateDoseDto {
    @ApiProperty({ description: 'Concentração' })
    @IsNumber()
    @IsNotEmpty()
    concentration?: number;

    @ApiProperty({ description: 'Volume' })
    @IsNumber()
    @IsNotEmpty()
    volume?: number;

    @ApiProperty({ description: 'Data da Aplicação' })
    @IsDateString()
    @IsNotEmpty()
    administeredAt?: Date;

    @ApiProperty({ description: 'Data do próximo agendamento' })
    @IsDateString()
    @IsNotEmpty()
    scheduledAt?: Date;

    @ApiProperty({ description: 'Próximo Intervalo em Dias' })
    @IsNumber()
    @IsNotEmpty()
    nextIntervalInDays?: number;

    @ApiProperty({ description: 'Efeitos Colaterais' })
    @IsString()
    @IsOptional()
    sideEffect?: string;

    @ApiProperty({ description: 'Necessidade de Medicação Durante a Aplicação' })
    @IsString()
    @IsOptional()
    medicationRequired?: string;

    @ApiProperty({ description: 'Notas Adicionais' })
    @IsString()
    @IsOptional()
    notes?: string;   
}



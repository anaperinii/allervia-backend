import { IsEnum, IsNotEmpty } from "@nestjs/class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { TherapyStatus } from "@prisma/client";

export class UpdateImmunotherapyStatusDto {
    @ApiProperty({description: 'Status'})
    @IsEnum(TherapyStatus, {message: 'Status inválido fornecido.'})
    @IsNotEmpty()
    status: TherapyStatus;
}


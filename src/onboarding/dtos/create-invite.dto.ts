import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { IsEmail, IsEnum, IsNotEmpty, IsString } from "class-validator";

export class CreateInviteDto {

    @ApiProperty({ description: 'E-mail do Profissional' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ description: 'Nome Completo' })
    @IsNotEmpty()
    @IsString()
    fullName: string;

    @IsEnum(Role, {message: 'Role especificada inválida'})
    @IsNotEmpty()
    userRole: Role;
}
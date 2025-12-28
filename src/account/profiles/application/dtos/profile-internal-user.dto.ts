import { IsNotEmpty, IsString } from "@nestjs/class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

export class ProfileInternalUserDto {

    @ApiProperty({ description: 'Nome Completo' })
    @IsNotEmpty()
    @IsString()
    fullName: string;
    
    @ApiProperty({ description: 'Senha' })
    @IsNotEmpty()
    @IsString()
    password: string;

    @ApiProperty({ description: 'Especialidade/Atuação', required: false})
    @IsString()
    @IsOptional()
    specialty?: string;
 
    @ApiProperty({ description: 'Telefone Comercial de Contato'})
    @IsString()
    @IsOptional()
    phoneNumber: string; 
}
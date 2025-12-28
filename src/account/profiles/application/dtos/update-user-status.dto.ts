import { IsBoolean, IsNotEmpty } from "@nestjs/class-validator";

export class UpdateUserStatusDto {
    @IsBoolean()
    @IsNotEmpty()
    isActive: boolean;
}
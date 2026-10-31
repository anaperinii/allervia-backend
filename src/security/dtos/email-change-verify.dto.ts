import { IsNotEmpty, IsString } from 'class-validator';

export class EmailChangeVerifyDTO {
  @IsNotEmpty()
  @IsString()
  token: string;
}

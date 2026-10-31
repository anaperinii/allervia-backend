import { IsNotEmpty, IsString } from 'class-validator';

export class EmailChangeConfirmDTO {
  @IsNotEmpty()
  @IsString()
  token: string;
}

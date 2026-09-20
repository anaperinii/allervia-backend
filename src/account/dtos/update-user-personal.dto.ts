import { UpdateUserDto } from './update-user.dto';
import { PartialType, OmitType } from '@nestjs/swagger';

export class UpdateUserPersonalDto extends PartialType(
  OmitType(UpdateUserDto, ['email', 'password']),
) {}

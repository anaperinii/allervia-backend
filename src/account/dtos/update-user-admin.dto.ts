import { OmitType, PartialType } from '@nestjs/swagger';
import { UpdateUserDto } from './update-user.dto';

export class UpdateUserAdminDto extends PartialType(
  OmitType(UpdateUserDto, ['specialty']),
) {}

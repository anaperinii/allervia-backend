import { OmitType, PartialType } from "@nestjs/swagger";
import { ProfileSystemUserDto } from "./profile-system-user.dto";

export class UpdateUserAdminDto extends PartialType(OmitType(ProfileSystemUserDto, ['key'])) {}
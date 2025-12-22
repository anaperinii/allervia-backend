import { PartialType } from "@nestjs/mapped-types";
import { PickType } from "@nestjs/swagger";
import { ProfileInternalUserDto } from "./profile-internal-user.dto";

export class UpdateUserPersonalDto extends PartialType(PickType(ProfileInternalUserDto, ['fullName', 'password', 'specialty', 'phoneNumber'])) {}
import { PartialType, PickType } from "@nestjs/swagger";
import { ProfileInternalUserDto } from "./profile-internal-user.dto";

export class UpdateUserBackofficeDto extends PartialType(PickType(ProfileInternalUserDto, ['fullName', 'specialty', 'phoneNumber'])) {}
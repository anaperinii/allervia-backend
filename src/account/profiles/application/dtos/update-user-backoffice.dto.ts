import { PartialType, PickType } from "@nestjs/swagger";
import { UpdateUserDto } from "./update-user.dto";

export class UpdateUserBackofficeDto extends PartialType(PickType(UpdateUserDto, ['fullName', 'specialty', 'phoneNumber'])) {}
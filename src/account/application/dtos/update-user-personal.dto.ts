import { PartialType } from "@nestjs/mapped-types";
import { UpdateUserDto } from "./update-user.dto";
import { OmitType } from "@nestjs/swagger";

export class UpdateUserPersonalDto extends PartialType(OmitType(UpdateUserDto, ['email'])) {}
import { PartialType } from "@nestjs/mapped-types";
import { CreateImmunotherapyDto } from "./create-immunotherapy.dto";

export class UpdateImmunotherapyDto extends PartialType(CreateImmunotherapyDto) {}


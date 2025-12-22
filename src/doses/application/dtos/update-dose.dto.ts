import { PartialType } from '@nestjs/mapped-types';
import { CreateDoseDto } from './create-dose.dto';

export class UpdateDoseDto extends PartialType(CreateDoseDto) {}


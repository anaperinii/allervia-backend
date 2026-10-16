import { PartialType } from '@nestjs/swagger';
import { CreatePatientDto } from './create-patient.dto';
/**
 * Use the Swagger PartialType helper to publish optional patient fields in
 * the generated HTTP contract while retaining runtime validation.
 * The mapped-types helper alone does not propagate Swagger metadata and
 * previously caused this DTO to appear as an empty object in the contract.
 */


export class UpdatePatientDto extends PartialType(CreatePatientDto) {}

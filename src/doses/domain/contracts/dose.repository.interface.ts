import { Dose } from '../entities/dose.entity';
import { CreateDoseData, UpdateDoseData } from './interfaces/doses.interface';

export abstract class IDoseRepository {
  abstract create(dose: CreateDoseData): Promise<Dose>;
  abstract update(doseId: string, dose: Partial<UpdateDoseData>): Promise<Dose>;
  abstract findById(id: string, orgId: string): Promise<Dose | null>;
  abstract findByImmunotherapy(immunotherapyId: string, orgId: string): Promise<Dose[]>;
  abstract exists(id: string): Promise<boolean>;
}


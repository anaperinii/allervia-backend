import { Organization } from '@prisma/client';

export abstract class OrganizationRepository {
  abstract create(organization: Organization): Promise<Organization>;
  abstract update(organization: Organization): Promise<Organization>;
  abstract save(organization: Organization): Promise<Organization>;
  abstract findById(id: string): Promise<Organization | null>;
  abstract exists(id: string): Promise<boolean>;
  abstract findByName(name: string): Promise<Organization | null>;
  abstract findByTaxId(taxId: string): Promise<Organization | null>;
}

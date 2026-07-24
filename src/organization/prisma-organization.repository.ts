import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { OrganizationRepository } from './organization.repository';
import { Organization } from '@prisma/client';

@Injectable()
export class PrismaOrganizationRepository extends OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(organization: Organization): Promise<Organization> {
    const created = await this.prisma.organization.create({
      data: {
        id: organization.id,
        name: organization.name,
        taxId: organization.taxId,
        isActive: organization.isActive,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });

    return created;
  }

  async update(organization: Organization): Promise<Organization> {
    const updated = await this.prisma.organization.update({
      where: { id: organization.id },
      data: {
        name: organization.name,
        taxId: organization.taxId,
        isActive: organization.isActive,
        updatedAt: organization.updatedAt,
      },
    });

    return updated;
  }

  async save(organization: Organization): Promise<Organization> {
    const exists = await this.exists(organization.id);
    return exists
      ? await this.update(organization)
      : await this.create(organization);
  }

  async findById(id: string): Promise<Organization | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id },
    });

    return org;
  }

  async findByName(name: string): Promise<Organization | null> {
    const org = await this.prisma.organization.findUnique({
      where: { name },
    });

    return org;
  }

  async findByTaxId(taxId: string): Promise<Organization | null> {
    const org = await this.prisma.organization.findUnique({
      where: { taxId },
    });

    return org;
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.organization.count({
      where: { id },
    });

    return count > 0;
  }
}

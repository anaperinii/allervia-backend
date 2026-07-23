import { Injectable, ConflictException } from '@nestjs/common';
import { OrganizationRepository } from '../organization.repository';
import { CreateOrganizationDto } from '../dtos/create-organization.dto';
import { OrganizationResponseDto } from '../dtos/organization-response.dto';
import { ORGANIZATION_MESSAGES } from '../organization.messages';
import { Organization } from '@prisma/client';

@Injectable()
export class CreateOrganizationUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepository
  ) {}

  async execute(dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    const existingByName = await this.organizationRepository.findByName(dto.name);

    if (existingByName) {
      throw new ConflictException(ORGANIZATION_MESSAGES.alreadyExists('name', dto.name));
    }

    const existingByTaxId = await this.organizationRepository.findByTaxId(dto.taxId);

    if (existingByTaxId) {
      throw new ConflictException(ORGANIZATION_MESSAGES.alreadyExists('taxId', dto.taxId));
    }

    const savedOrganization = await this.organizationRepository.create(dto as Organization);

    return savedOrganization;
  }
}


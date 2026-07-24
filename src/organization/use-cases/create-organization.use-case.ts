import { Injectable, ConflictException } from '@nestjs/common';
import { OrganizationRepository } from 'src/organization/organization.repository';
import { CreateOrganizationDto } from 'src/organization/dtos/create-organization.dto';
import { OrganizationResponseDto } from 'src/organization/dtos/organization-response.dto';
import { ORGANIZATION_MESSAGES } from 'src/organization/organization.messages';
import { Organization } from '@prisma/client';

@Injectable()
export class CreateOrganizationUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async execute(dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    const existingByName = await this.organizationRepository.findByName(
      dto.name,
    );

    if (existingByName) {
      throw new ConflictException(
        ORGANIZATION_MESSAGES.alreadyExists('name', dto.name),
      );
    }

    const existingByTaxId = await this.organizationRepository.findByTaxId(
      dto.taxId,
    );

    if (existingByTaxId) {
      throw new ConflictException(
        ORGANIZATION_MESSAGES.alreadyExists('taxId', dto.taxId),
      );
    }

    const savedOrganization = await this.organizationRepository.create(
      dto as Organization,
    );

    return savedOrganization;
  }
}

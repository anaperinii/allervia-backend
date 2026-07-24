import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRepository } from 'src/organization/organization.repository';
import { OrganizationResponseDto } from 'src/organization/dtos/organization-response.dto';
import { ORGANIZATION_MESSAGES } from 'src/organization/organization.messages';

@Injectable()
export class FindOrganizationUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepository
  ) {}

  async execute(id: string): Promise<OrganizationResponseDto> {
    const organization = await this.organizationRepository.findById(id);

    if (!organization) {
      throw new NotFoundException(ORGANIZATION_MESSAGES.notFound(id));
    }

    return organization;
  }
}


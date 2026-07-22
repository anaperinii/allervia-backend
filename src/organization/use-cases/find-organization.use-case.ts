import { Injectable } from '@nestjs/common';
import { OrganizationRepository } from '../organization.repository';
import { OrganizationResponseDto } from '../dtos/organization-response.dto';
import { OrganizationNotFoundException } from '../exceptions/organization-not-found.exception';

@Injectable()
export class FindOrganizationUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepository
  ) {}

  async execute(id: string): Promise<OrganizationResponseDto> {
    const organization = await this.organizationRepository.findById(id);

    if (!organization) {
      throw new OrganizationNotFoundException(id);
    }

    return organization;
  }
}


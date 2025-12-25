import { Injectable } from '@nestjs/common';
import { IOrganizationRepository } from '../../domain/contracts/organization.repository.interface';
import { OrganizationResponseDto } from '../dtos/organization-response.dto';
import { OrganizationNotFoundException } from '../../domain/exceptions/organization-not-found.exception';

@Injectable()
export class FindOrganizationUseCase {
  constructor(
    private readonly organizationRepository: IOrganizationRepository
  ) {}

  async execute(id: string): Promise<OrganizationResponseDto> {
    const organization = await this.organizationRepository.findById(id);

    if (!organization) {
      throw new OrganizationNotFoundException(id);
    }

    return organization;
  }
}


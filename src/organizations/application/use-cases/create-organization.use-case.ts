import { ConflictException, Injectable } from '@nestjs/common';
import { IOrganizationRepository } from '../../domain/contracts/organization.repository.interface';
import { CreateOrganizationDto } from '../dtos/create-organization.dto';
import { OrganizationResponseDto } from '../dtos/organization-response.dto';
import { OrganizationAlreadyExistsException } from '../../domain/exceptions/organization-already-exists.exception';
import { Organization } from 'src/organizations/domain/entities/organization.entity';

@Injectable()
export class CreateOrganizationUseCase {
  constructor(
    private readonly organizationRepository: IOrganizationRepository
  ) {}

  async execute(dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    // Valida se já existe organização com mesmo nome ou CNPJ
    const existingByName = await this.organizationRepository.findByName(dto.name);
    if (existingByName) {
      throw new OrganizationAlreadyExistsException('name', dto.name);
    }

    const existingByTaxId = await this.organizationRepository.findByTaxId(dto.taxId);
    if (existingByTaxId) {
      throw new OrganizationAlreadyExistsException('taxId', dto.taxId);
    }

    const organization = new Organization({
      name: dto.name,
      taxId: dto.taxId,
    });

    const savedOrganization = await this.organizationRepository.create(organization);

    return savedOrganization;
  }
}


import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Membership } from '../../domain/entities/membership.entity';
import { IMembershipRepository } from '../../domain/contracts/membership.repository.interface';
import { AddMembershipDto } from '../dtos/add-membership.dto';
import { MembershipResponseDto } from '../dtos/membership-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { FindOrganizationUseCase } from 'src/organizations/application/use-cases/find-organization.use-case';

@Injectable()
export class AddMembershipUseCase {
  constructor(
    private membershipRepository: IMembershipRepository,
    private findOrganizationUseCase: FindOrganizationUseCase,
  ) {}

  async execute(
    dto: AddMembershipDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<MembershipResponseDto> {

    const exists = await this.membershipRepository.exists(currentUser.id, dto.organizationId);

    if (exists) {
      throw new ConflictException('Membership já existe');
    }

    await this.findOrganizationUseCase.execute(dto.organizationId);

    const membership = Membership.createNew({
      userId: currentUser.id,
      organizationId: dto.organizationId
    });

    const savedMembership = await this.membershipRepository.create(membership);

    return savedMembership;
  }
}


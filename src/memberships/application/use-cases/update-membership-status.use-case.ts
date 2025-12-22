import { Injectable, NotFoundException } from '@nestjs/common';
import { IMembershipRepository } from '../../domain/contracts/membership.repository.interface';
import { UpdateMembershipStatusDto } from '../dtos/update-membership-status.dto';
import { MembershipResponseDto } from '../dtos/membership-response.dto';

@Injectable()
export class UpdateMembershipStatusUseCase {
  constructor(
    private membershipRepository: IMembershipRepository
  ) {}

  async execute(
    membershipId: string,
    dto: UpdateMembershipStatusDto,
  ): Promise<MembershipResponseDto> {
    const membership = await this.membershipRepository.findById(membershipId);

    if (!membership) {
      throw new NotFoundException('Membership não encontrada');
    }

    const updatedMembership =  await this.membershipRepository.update(membership);

    return updatedMembership;
  }
}


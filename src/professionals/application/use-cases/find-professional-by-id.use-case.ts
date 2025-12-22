import { Injectable } from '@nestjs/common';
import { IProfessionalRepository } from '../../domain/professional.repository.interface';
import { AuthenticatedUserPayload } from 'src/security/types/auth.types';
import { ProfessionalNotFoundException } from '../../domain/exceptions/professional-not-found.exception';
import { FindUserByIdUseCase } from 'src/account/application/use-cases/find-user-by-id.use-case';

@Injectable()
export class FindProfessionalByIdUseCase {
  constructor(
    private readonly professionalRepository: IProfessionalRepository,
    private readonly findUserById: FindUserByIdUseCase
  ) {}

  async execute(
    id: string,
    currentUser: AuthenticatedUserPayload
  ) {
    const professional = await this.professionalRepository.findProfessionalById(id, currentUser);

    if (!professional) {
      throw new ProfessionalNotFoundException(id);
    }

    const user = await this.findUserById.execute(professional.userId, currentUser);

    const userData = {
      fullName: user.fullName,
      email: user.email,
      type: user.type,
      organizationId: user.organizationId
    }

    return {professional, userData};
  }
}


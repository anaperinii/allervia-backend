import { Injectable } from '@nestjs/common';
import { IRoleRepository } from '../../role.repository';

@Injectable()
export class ListProfessionalRolesUseCase {
  constructor(private roleRepository: IRoleRepository) {}

  async execute(professionalId: string) {
    return this.roleRepository.findActiveByProfessional(professionalId);
  }
}

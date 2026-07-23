import { Injectable } from '@nestjs/common';
import { IRoleRepository } from '../../role.repository';
import { ITransactionContext } from 'src/database/transaction.interface';

@Injectable()
export class ListProfessionalRolesUseCase {
  constructor(private roleRepository: IRoleRepository) {}

  async execute(professionalId: string, tx?: ITransactionContext) {
    return this.roleRepository.findActiveByProfessional(professionalId, tx);
  }
}

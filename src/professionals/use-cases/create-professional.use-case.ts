import { Injectable } from '@nestjs/common';
import { ProfessionalRepository } from 'src/professionals/professional.repository';
import { CreateProfessionalData } from 'src/professionals/professional.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class CreateProfessionalUseCase {
  constructor(private professionalRepository: ProfessionalRepository) {}

  async execute(data: CreateProfessionalData, tx?: Prisma.TransactionClient) {
    return this.professionalRepository.create(data, tx);
  }
}

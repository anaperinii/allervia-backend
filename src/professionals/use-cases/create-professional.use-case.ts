import { Injectable } from '@nestjs/common';
import { ProfessionalRepository } from '../professional.repository';
import { CreateProfessionalData } from '../professional.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class CreateProfessionalUseCase {
  constructor(private professionalRepository: ProfessionalRepository) {}

  async execute(data: CreateProfessionalData, tx?: Prisma.TransactionClient) {
    return this.professionalRepository.create(data, tx);
  }
}

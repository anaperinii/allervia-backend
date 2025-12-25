import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma/prisma.module';
import { OrganizationsModule } from 'src/organizations/organizations.module';
import { AddMembershipUseCase } from './application/use-cases/add-membership.use-case';
import { UpdateMembershipStatusUseCase } from './application/use-cases/update-membership-status.use-case';
import { IMembershipRepository } from './domain/contracts/membership.repository.interface';
import { PrismaMembershipRepository } from './infrastructure/persistence/prisma-membership.repository';
import { ListMembershipsByUserUseCase } from './application/use-cases/list-memberships-by-user.use-case';
import { MembershipsController } from './presentation/controllers/memberships.controller';
import { AddMembershipForAdminUseCase } from './application/use-cases/add-membership-for-admin.use-case';
import { ChangeMembershipStatusUseCase } from './application/use-cases/change-membership-status.use-case';

@Module({
  imports: [PrismaModule, OrganizationsModule],
  controllers: [MembershipsController],
  providers: [
    // Use Cases
    AddMembershipUseCase,
    UpdateMembershipStatusUseCase,
    ListMembershipsByUserUseCase,
    AddMembershipForAdminUseCase,
    ChangeMembershipStatusUseCase,

    // Repositories
    {
      provide: IMembershipRepository,
      useClass: PrismaMembershipRepository,
    },
  ],
  exports: [IMembershipRepository],
})
export class MembershipsModule {}

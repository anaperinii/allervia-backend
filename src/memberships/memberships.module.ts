import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma/prisma.module';
import { OrganizationsModule } from 'src/organizations/organizations.module';
import { AddMembershipUseCase } from './application/use-cases/add-membership.use-case';
import { IMembershipRepository } from './domain/contracts/membership.repository.interface';
import { PrismaMembershipRepository } from './infrastructure/persistence/prisma-membership.repository';
import { ListMembershipsByUserUseCase } from './application/use-cases/list-memberships-by-user.use-case';
import { MembershipsController } from './presentation/controllers/memberships.controller';
import { ChangeMembershipStatusUseCase } from './application/use-cases/change-membership-status.use-case';
import { AddMembershipForSystemAdminUseCase } from './application/use-cases/add-membership-for-admin.use-case';

@Module({
  imports: [PrismaModule, OrganizationsModule],
  controllers: [MembershipsController],
  providers: [
    // Use Cases
    AddMembershipUseCase,
    ChangeMembershipStatusUseCase,
    ListMembershipsByUserUseCase,
    AddMembershipForSystemAdminUseCase,
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

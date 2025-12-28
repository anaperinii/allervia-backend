import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma.module';
import { OrganizationsModule } from 'src/organizations/organizations.module';
import { AddMembershipUseCase } from './use-cases/add-membership.use-case';
import { IMembershipRepository } from './domain/interfaces/membership.repository.interface';
import { PrismaMembershipRepository } from './infrastructure/repositories/prisma-membership.repository';
import { ListMembershipsByUserUseCase } from './use-cases/list-memberships-by-user.use-case';
import { MembershipsController } from './controllers/memberships.controller';
import { ChangeMembershipStatusUseCase } from './use-cases/change-membership-status.use-case';
import { AddMembershipForSystemAdminUseCase } from './use-cases/add-membership-for-admin.use-case';

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

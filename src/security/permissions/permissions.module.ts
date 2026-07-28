import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { RolesController } from './roles.controller';
import { IRoleRepository } from './role.repository';
import { PrismaRoleRepository } from './prisma-role.repository';
import { GrantRoleUseCase } from './use-cases/grant-role.use-case';
import { RevokeRoleUseCase } from './use-cases/revoke-role.use-case';
import { FindRoleByIdUseCase } from './use-cases/find-role-by-id.use-case';
import { ListProfessionalRolesUseCase } from './use-cases/list-professional-roles.use-case';
import { AbilityFactory } from './ability/ability.factory';

@Module({
  imports: [PrismaModule],
  providers: [
    GrantRoleUseCase,
    RevokeRoleUseCase,
    FindRoleByIdUseCase,
    ListProfessionalRolesUseCase,
    AbilityFactory,
    {
      provide: IRoleRepository,
      useClass: PrismaRoleRepository,
    },
  ],
  controllers: [RolesController],
  exports: [IRoleRepository, GrantRoleUseCase, AbilityFactory],
})
export class PermissionsModule {}

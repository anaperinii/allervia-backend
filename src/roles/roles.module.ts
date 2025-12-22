import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RolesController } from './presentation/controllers/roles.controller';
import { CreateRoleUseCase } from './application/use-cases/create-role.use-case';
import { ListRolesUseCase } from './application/use-cases/list-roles.use-case';
import { FindRoleByIdUseCase } from './application/use-cases/find-role-by-id.use-case';
import { UpdateRoleUseCase } from './application/use-cases/update-role.use-case';
import { DeleteRoleUseCase } from './application/use-cases/delete-role.use-case';
import { AddRoleToUserUseCase } from './application/use-cases/add-role-to-user.use-case';
import { IRoleRepository } from './domain/repositories/role.repository.interface';
import { PrismaRoleRepository } from './infrastructure/persistence/prisma-role.repository';
import { FindRoleByNameUseCase } from './application/use-cases/find-role-by-name.use-case';
import { FindUserRoleByNameUseCase } from './application/use-cases/find-user-role-by-name.use-case';
import { AccountModule } from 'src/account/account.module';

@Module({
  imports: [PrismaModule, AccountModule],
  providers: [
    // Use Cases
    CreateRoleUseCase,
    ListRolesUseCase,
    FindRoleByIdUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    AddRoleToUserUseCase,
    FindRoleByNameUseCase,
    FindUserRoleByNameUseCase,

    // Repositories
    {
      provide: IRoleRepository,
      useClass: PrismaRoleRepository,
    },
  ],
  controllers: [RolesController],
  exports: [IRoleRepository, AddRoleToUserUseCase],
})
export class RolesModule {}

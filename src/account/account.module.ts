import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma/prisma.module';
import { AccountController } from './profiles/presentation/account.controller';
import { FindUserByIdUseCase } from './profiles/application/use-cases/find-user-by-id.use-case';
import { CreateSystemAdminUseCase } from './profiles/application/use-cases/create-system-admin.use-case';
import { UpdateUserStatusUseCase } from './profiles/application/use-cases/update-user-status.use-case';
import { IUserRepository } from './profiles/domain/contracts/user.repository.interface';
import { PrismaUserRepository } from './profiles/infrastructure/persistence/prisma-user.repository';
import { ArchiveUserUseCase } from './profiles/application/use-cases/archive-user.use-case';
import { UserResponseDto } from './profiles/application/dtos/user-response.dto';
import { ValidateUserEmailUseCase } from './profiles/application/use-cases/validate-user-email.use-case';
import { UpdateUserPersonalDto } from './profiles/application/dtos/update-user-personal.dto';
import { UpdateUserStatusDto } from './profiles/application/dtos/update-user-status.dto';
import { UpdateUserBackofficeDto } from './profiles/application/dtos/update-user-backoffice.dto';
import { UpdateUserAdminDto } from './profiles/application/dtos/update-user-admin.dto';
import { ProfileInternalUserDto } from './profiles/application/dtos/profile-internal-user.dto';
import { ProfileSystemUserDto } from './profiles/application/dtos/profile-system-user.dto';
import { UpdateUserUseCase } from './profiles/application/use-cases/update-user.use-case';
import { AddRoleToUserUseCase } from './roles/application/use-cases/add-role-to-user.use-case';
import { CreateRoleUseCase } from './roles/application/use-cases/create-role.use-case';
import { DeleteRoleUseCase } from './roles/application/use-cases/delete-role.use-case';
import { FindRoleByIdUseCase } from './roles/application/use-cases/find-role-by-id.use-case';
import { FindRoleByNameUseCase } from './roles/application/use-cases/find-role-by-name.use-case';
import { FindUserRoleByNameUseCase } from './roles/application/use-cases/find-user-role-by-name.use-case';
import { ListRolesUseCase } from './roles/application/use-cases/list-roles.use-case';
import { UpdateRoleUseCase } from './roles/application/use-cases/update-role.use-case';
import { IRoleRepository } from './roles/domain/contracts/role.repository.interface';
import { PrismaRoleRepository } from './roles/infrastructure/persistence/prisma-role.repository';
import { RolesController } from './roles/presentation/controllers/roles.controller';
import { IPasswordHashingService } from 'src/security/domain/contracts/password-hashing.service.interface';
import { BcryptPasswordHashingService } from 'src/security/infrastructure/cryptography/bcrypt-password-hashing.service';

@Module({
  providers: [
    // Use Cases
    FindUserByIdUseCase,
    CreateSystemAdminUseCase,
    UpdateUserStatusUseCase,
    ArchiveUserUseCase,
    ValidateUserEmailUseCase,
    UpdateUserUseCase,
    CreateRoleUseCase,
    ListRolesUseCase,
    FindRoleByIdUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    AddRoleToUserUseCase,
    FindRoleByNameUseCase,
    FindUserRoleByNameUseCase,

    // DTOs
    UserResponseDto,
    UpdateUserStatusDto,
    UpdateUserPersonalDto,
    UpdateUserBackofficeDto,
    UpdateUserAdminDto,
    ProfileInternalUserDto,
    ProfileSystemUserDto,

    // Repositories
    {
      provide: IUserRepository,
      useClass: PrismaUserRepository,
    },
    {
      provide: IRoleRepository,
      useClass: PrismaRoleRepository,
    },

    // Services
    {
      provide: IPasswordHashingService,
      useClass: BcryptPasswordHashingService,
    },
  ],
  imports: [PrismaModule],
  controllers: [AccountController, RolesController],
  exports: [
    IUserRepository, 
    FindUserByIdUseCase, 
    ValidateUserEmailUseCase,
    IRoleRepository, 
    AddRoleToUserUseCase
  ],
})
export class AccountModule {}

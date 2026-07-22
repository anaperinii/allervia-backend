import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma.module';
import { AccountController } from './account.controller';
import { FindUserByIdUseCase } from './use-cases/users/find-user-by-id.use-case';
import { CreateSystemAdminUseCase } from './use-cases/users/create-system-admin.use-case';
import { UpdateUserStatusUseCase } from './use-cases/users/update-user-status.use-case';
import { PrismaUserRepository } from './prisma-user.repository';
import { ArchiveUserUseCase } from './use-cases/users/archive-user.use-case';
import { ValidateUserEmailUseCase } from './use-cases/users/validate-user-email.use-case';
import { UpdateUserUseCase } from './use-cases/users/update-user.use-case';
import { AddRoleToUserUseCase } from './use-cases/roles/add-role-to-user.use-case';
import { CreateRoleUseCase } from './use-cases/roles/create-role.use-case';
import { DeleteRoleUseCase } from './use-cases/roles/delete-role.use-case';
import { FindRoleByIdUseCase } from './use-cases/roles/find-role-by-id.use-case';
import { FindRoleByNameUseCase } from './use-cases/roles/find-role-by-name.use-case';
import { FindUserRoleByNameUseCase } from './use-cases/roles/find-user-role-by-name.use-case';
import { ListRolesUseCase } from './use-cases/roles/list-roles.use-case';
import { UpdateRoleUseCase } from './use-cases/roles/update-role.use-case';
import { IRoleRepository } from './role.repository';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { BcryptPasswordHashingService } from 'src/security/infrastructure/cryptography/bcrypt-password-hashing.service';
import { RolesController } from './roles.controller';
import { IUserRepository } from './user.repository';
import { ProfileInternalUserDto } from './dtos/users/profile-internal-user.dto';
import { ProfileSystemUserDto } from './dtos/users/profile-system-user.dto';
import { UpdateUserAdminDto } from './dtos/users/update-user-admin.dto';
import { UpdateUserBackofficeDto } from './dtos/users/update-user-backoffice.dto';
import { UpdateUserPersonalDto } from './dtos/users/update-user-personal.dto';
import { UpdateUserStatusDto } from './dtos/users/update-user-status.dto';
import { UserResponseDto } from './dtos/users/user-response.dto';
import { PrismaRoleRepository } from './prisma-role.repository';

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

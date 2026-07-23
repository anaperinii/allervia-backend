import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma.module';
import { AccountController } from './account.controller';
import { FindUserByIdUseCase } from './use-cases/users/find-user-by-id.use-case';
import { UpdateUserStatusUseCase } from './use-cases/users/update-user-status.use-case';
import { PrismaUserRepository } from './prisma-user.repository';
import { ArchiveUserUseCase } from './use-cases/users/archive-user.use-case';
import { ValidateUserEmailUseCase } from './use-cases/users/validate-user-email.use-case';
import { UpdateUserUseCase } from './use-cases/users/update-user.use-case';
import { GrantRoleUseCase } from './use-cases/roles/grant-role.use-case';
import { RevokeRoleUseCase } from './use-cases/roles/revoke-role.use-case';
import { FindRoleByIdUseCase } from './use-cases/roles/find-role-by-id.use-case';
import { ListProfessionalRolesUseCase } from './use-cases/roles/list-professional-roles.use-case';
import { IRoleRepository } from './role.repository';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { BcryptPasswordHashingService } from 'src/security/bcrypt-password-hashing.service';
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
    UpdateUserStatusUseCase,
    ArchiveUserUseCase,
    ValidateUserEmailUseCase,
    UpdateUserUseCase,
    GrantRoleUseCase,
    RevokeRoleUseCase,
    FindRoleByIdUseCase,
    ListProfessionalRolesUseCase,

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
    GrantRoleUseCase
  ],
})
export class AccountModule {}

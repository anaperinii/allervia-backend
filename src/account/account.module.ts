import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { AuthModule } from 'src/security/auth.module';
import { AccountController } from './account.controller';
import { FindUserByIdUseCase } from './use-cases/users/find-user-by-id.use-case';
import { UpdateUserStatusUseCase } from './use-cases/users/update-user-status.use-case';
import { PrismaUserRepository } from './prisma-user.repository';
import { ArchiveUserUseCase } from './use-cases/users/archive-user.use-case';
import { ValidateUserEmailUseCase } from './use-cases/users/validate-user-email.use-case';
import { UpdateUserUseCase } from './use-cases/users/update-user.use-case';
import { IUserRepository } from './user.repository';
import { ProfileInternalUserDto } from './dtos/users/profile-internal-user.dto';
import { ProfileSystemUserDto } from './dtos/users/profile-system-user.dto';
import { UpdateUserAdminDto } from './dtos/users/update-user-admin.dto';
import { UpdateUserBackofficeDto } from './dtos/users/update-user-backoffice.dto';
import { UpdateUserPersonalDto } from './dtos/users/update-user-personal.dto';
import { UpdateUserStatusDto } from './dtos/users/update-user-status.dto';
import { UserResponseDto } from './dtos/users/user-response.dto';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [
    // Use Cases
    FindUserByIdUseCase,
    UpdateUserStatusUseCase,
    ArchiveUserUseCase,
    ValidateUserEmailUseCase,
    UpdateUserUseCase,

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
  ],
  controllers: [AccountController],
  exports: [IUserRepository, FindUserByIdUseCase, ValidateUserEmailUseCase],
})
export class AccountModule {}

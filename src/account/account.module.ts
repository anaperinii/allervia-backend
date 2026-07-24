import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { AuthModule } from 'src/security/auth.module';
import { AccountController } from './account.controller';
import { FindUserByIdUseCase } from './use-cases/find-user-by-id.use-case';
import { UpdateUserStatusUseCase } from './use-cases/update-user-status.use-case';
import { PrismaUserRepository } from './prisma-user.repository';
import { ArchiveUserUseCase } from './use-cases/archive-user.use-case';
import { ValidateUserEmailUseCase } from './use-cases/validate-user-email.use-case';
import { UpdateUserUseCase } from './use-cases/update-user.use-case';
import { IUserRepository } from './user.repository';
import { ProfileInternalUserDto } from './dtos/profile-internal-user.dto';
import { ProfileSystemUserDto } from './dtos/profile-system-user.dto';
import { UpdateUserAdminDto } from './dtos/update-user-admin.dto';
import { UpdateUserBackofficeDto } from './dtos/update-user-backoffice.dto';
import { UpdateUserPersonalDto } from './dtos/update-user-personal.dto';
import { UpdateUserStatusDto } from './dtos/update-user-status.dto';
import { UserResponseDto } from './dtos/user-response.dto';

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

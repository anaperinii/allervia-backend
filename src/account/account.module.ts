import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/database/prisma/prisma.module';
import { AccountController } from './presentation/account.controller';
import { FindUserByIdUseCase } from './application/use-cases/find-user-by-id.use-case';
import { CreateSystemAdminUseCase } from './application/use-cases/create-system-admin.use-case';
import { UpdateUserStatusUseCase } from './application/use-cases/update-user-status.use-case';
import { IUserRepository } from './domain/contracts/user.repository.interface';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { IHashingService } from './domain/contracts/hashing.service.interface';
import { BcryptService } from './infrastructure/cryptography/bcrypt.service';
import { ArchiveUserUseCase } from './application/use-cases/archive-user.use-case';
import { UserResponseDto } from './application/dtos/user-response.dto';
import { ValidateUserEmailUseCase } from './application/use-cases/validate-user-email.use-case';
import { UpdateUserPersonalDto } from './application/dtos/update-user-personal.dto';
import { UpdateUserStatusDto } from './application/dtos/update-user-status.dto';
import { UpdateUserBackofficeDto } from './application/dtos/update-user-backoffice.dto';
import { UpdateUserAdminDto } from './application/dtos/update-user-admin.dto';
import { ProfileInternalUserDto } from './application/dtos/profile-internal-user.dto';
import { ProfileSystemUserDto } from './application/dtos/profile-system-user.dto';
import { UserProfessionalResponseDto } from './application/dtos/user-professional-response.dto';

@Module({
  providers: [
    // Use Cases
    FindUserByIdUseCase,
    CreateSystemAdminUseCase,
    UpdateUserStatusUseCase,
    ArchiveUserUseCase,
    ValidateUserEmailUseCase,

    // DTOs
    UserResponseDto,
    UpdateUserStatusDto,
    UpdateUserPersonalDto,
    UpdateUserBackofficeDto,
    UpdateUserAdminDto,
    ProfileInternalUserDto,
    ProfileSystemUserDto,
    UserProfessionalResponseDto,

    // Repositories
    {
      provide: IUserRepository,
      useClass: PrismaUserRepository,
    },

    // Services
    {
      provide: IHashingService,
      useClass: BcryptService,
    },
  ],
  imports: [PrismaModule],
  controllers: [AccountController],
  exports: [
    IUserRepository, 
    IHashingService, 
    FindUserByIdUseCase, 
    ValidateUserEmailUseCase,
  ],
})
export class AccountModule {}

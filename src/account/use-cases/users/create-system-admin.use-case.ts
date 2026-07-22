import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IUserRepository } from '../../user.repository';
import { UserResponseDto } from '../../dtos/users/user-response.dto';
import { UserAlreadyExistsException } from '../../exceptions/users/user-already-exists.exception';
import { PrismaService } from 'src/database/prisma.service';
import { ProfileSystemUserDto } from '../../dtos/users/profile-system-user.dto';
import { ConfigService } from '@nestjs/config';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { User } from 'src/account/domain/entities/user.entity';

@Injectable()
export class CreateSystemAdminUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashingService: IPasswordHashingService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async execute(dto: ProfileSystemUserDto): Promise<UserResponseDto> {

    const secretKey = this.configService.get<string>('SUPER_ADMIN_REGISTRATION_KEY');

    if (dto.key !== secretKey) {
      throw new UnauthorizedException('Key inválida');
    }
    
    const exists = await this.userRepository.existsByEmail(dto.email);

    if (exists) {
      throw new UserAlreadyExistsException(dto.email);
    }

    const hashedPassword = await this.hashingService.hash(dto.password);

    const user = User.createNew({
      fullName: dto.fullName,
      email: dto.email,
      password: hashedPassword,
      type: 'SYSTEM_ADMIN',
    });

    const savedUser = await this.userRepository.create(user);

    await this.prisma.userRole.create({
      data: {
        userId: savedUser.id,
        roleTag: 'SYSTEM_ADMIN',
      },
    });

    return savedUser;
  }
}


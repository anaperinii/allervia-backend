import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { IUserRepository } from '../user.repository';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { IEmailService } from 'src/infra/email/email.service';
import { ChangePasswordDto } from '../dtos/change-password.dto';
import { USER_MESSAGES } from '../user.messages';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashingService: IPasswordHashingService,
    private readonly emailService: IEmailService,
  ) {}

  async execute(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException(USER_MESSAGES.notFound(userId));
    }

    const isCurrentValid = await this.hashingService.compare(
      dto.currentPassword,
      user.password,
    );

    if (!isCurrentValid) {
      throw new UnauthorizedException(USER_MESSAGES.invalidCurrentPassword);
    }

    const passwordHash = await this.hashingService.hash(dto.newPassword);

    await this.userRepository.changePassword(userId, passwordHash);
    await this.emailService.sendPasswordChangedNotification(user.email);
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IUserRepository } from 'src/account/user.repository';
import { UserResponseDto } from 'src/account/dtos/user-response.dto';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { UpdateUserDto } from 'src/account/dtos/update-user.dto';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { diffFields } from 'src/infra/audit/diff-fields';
import { USER_MESSAGES } from 'src/account/user.messages';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashingService: IPasswordHashingService,
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
  ) {}

  async execute(
    id: string,
    dto: UpdateUserDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findUserByIdInOrganization(
      id,
      currentUser.organizationId,
    );

    if (!user) {
      throw new NotFoundException(USER_MESSAGES.notFound(id));
    }

    if (dto.specialty !== undefined) {
      throw new BadRequestException(
        'O campo specialty ainda não possui persistência.',
      );
    }

    const data: { id: string; email?: string; password?: string } = { id };

    if (dto.email) {
      data.email = dto.email;
    }

    if (dto.password) {
      data.password = await this.hashingService.hash(dto.password);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.fullName !== undefined || dto.phoneNumber !== undefined) {
        const profile = await tx.professional.findFirst({
          where: { userId: id, organizationId: currentUser.organizationId },
        });
        if (!profile) {
          throw new BadRequestException(
            'A conta não possui perfil profissional.',
          );
        }
        const updatedProfile = await tx.professional.update({
          where: { id: profile.id },
          data: { fullName: dto.fullName, phoneNumber: dto.phoneNumber },
        });
        const profileDiff = diffFields(profile, updatedProfile, [
          'fullName',
          'phoneNumber',
        ]);
        if (profileDiff.changedFields.length > 0) {
          await this.auditLog.record(
            {
              userId: currentUser.id,
              organizationId: currentUser.organizationId,
              entityType: AUDIT_ENTITY_TYPES.PROFESSIONAL,
              entityId: profile.id,
              action: AUDIT_ACTIONS.PROFESSIONAL_UPDATED,
              ...profileDiff,
            },
            tx,
          );
        }
      }
      const updated = await this.userRepository.update(data, tx);

      const emailDiff = diffFields(user, updated, ['email']);

      if (emailDiff.changedFields.length > 0) {
        await this.auditLog.record(
          {
            userId: currentUser.id,
            organizationId: currentUser.organizationId,
            entityType: AUDIT_ENTITY_TYPES.USER,
            entityId: id,
            action: AUDIT_ACTIONS.USER_EMAIL_CHANGED,
            ...emailDiff,
          },
          tx,
        );
      }

      if (dto.password) {
        await this.auditLog.record(
          {
            userId: currentUser.id,
            organizationId: currentUser.organizationId,
            entityType: AUDIT_ENTITY_TYPES.USER,
            entityId: id,
            action: AUDIT_ACTIONS.PASSWORD_CHANGED,
          },
          tx,
        );
      }

      return UserResponseDto.from(updated);
    });
  }
}

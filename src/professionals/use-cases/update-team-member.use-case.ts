import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { diffFields } from 'src/infra/audit/diff-fields';
import { PrismaService } from 'src/infra/database/prisma.service';
import { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { PROFESSIONAL_MESSAGES } from '../professional.messages';
import { ProfessionalResponseDto } from '../dtos/professional-response.dto';
import { UpdateTeamMemberDto } from '../dtos/team-member.dto';

const AUDITED_FIELDS = [
  'fullName',
  'phoneNumber',
  'profession',
  'councilNumber',
  'councilUf',
] as const;

/**
 * Atualiza o cadastro profissional — o próprio ou, com capacidade
 * administrativa, o de um colega da mesma organização. Profissão descreve a
 * pessoa e não concede acesso: papéis continuam sendo concedidos à parte.
 */
@Injectable()
export class UpdateTeamMemberUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: IAuditLogService,
  ) {}

  async execute(
    professionalId: string,
    dto: UpdateTeamMemberDto,
    currentUser: AuthenticatedUserPayload,
  ): Promise<ProfessionalResponseDto> {
    const current = await this.prisma.professional.findFirst({
      where: { id: professionalId, organizationId: currentUser.organizationId },
    });

    if (!current) {
      throw new NotFoundException(
        PROFESSIONAL_MESSAGES.notFound(professionalId),
      );
    }

    if (
      dto.profession !== undefined &&
      current.id === currentUser.professionalId &&
      !currentUser.roles.includes('ADMINISTRATOR')
    ) {
      throw new ForbiddenException(PROFESSIONAL_MESSAGES.professionIsManaged);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.professional.update({
        where: { id: current.id },
        data: {
          fullName: dto.fullName,
          phoneNumber: dto.phoneNumber,
          profession: dto.profession,
          councilNumber: dto.councilNumber,
          councilUf: dto.councilUf?.toUpperCase(),
        },
      });

      const changes = diffFields(current, updated, [...AUDITED_FIELDS]);

      if (changes.changedFields.length > 0) {
        await this.auditLog.record(
          {
            userId: currentUser.id,
            organizationId: currentUser.organizationId,
            entityType: AUDIT_ENTITY_TYPES.PROFESSIONAL,
            entityId: current.id,
            action: AUDIT_ACTIONS.PROFESSIONAL_UPDATED,
            ...changes,
          },
          tx,
        );
      }

      return updated;
    });
  }
}

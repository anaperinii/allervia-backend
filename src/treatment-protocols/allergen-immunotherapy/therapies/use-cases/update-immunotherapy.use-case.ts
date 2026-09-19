import {
  ConflictException,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import type { AuthenticatedUserPayload } from 'src/security/types/authenticated-user.types';
import { ConfiguredDoseService } from '../../dosing/configured-dose.service';
import { UpdateImmunotherapyDto } from '../dtos/update-immunotherapy.dto';
@Injectable()
export class UpdateImmunotherapyUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clinical: ConfiguredDoseService,
    private readonly audit: IAuditLogService,
  ) {}
  async execute(
    id: string,
    dto: UpdateImmunotherapyDto,
    user: AuthenticatedUserPayload,
  ) {
    if (
      Object.keys(dto).some(
        (key) => !['immunoType', 'expectedRevision'].includes(key),
      )
    )
      throw new BadRequestException('PRESCRIPTION_REVISION_REQUIRED');
    return this.prisma.$transaction(async (tx) => {
      const therapy = await this.clinical.lockTherapy(tx, id, user);
      if (therapy.revision !== dto.expectedRevision)
        throw new ConflictException('STALE_CLINICAL_REVISION');
      const updated = await tx.immunotherapy.update({
        where: { id },
        data: {
          immunoType: dto.immunoType,
          revision: { increment: 1 },
          updatedById: user.id,
        },
      });
      await this.audit.record(
        {
          userId: user.id,
          organizationId: user.organizationId,
          entityType: 'Immunotherapy',
          entityId: id,
          action: 'IMMUNOTHERAPY_UPDATED',
          oldValues: { immunoType: therapy.immunoType },
          newValues: { immunoType: updated.immunoType },
          changedFields: ['immunoType'],
        },
        tx,
      );
      return updated;
    });
  }
}

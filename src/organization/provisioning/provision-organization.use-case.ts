import { ConflictException, Injectable } from '@nestjs/common';
import { Profession, Role } from '@prisma/client';
import { IAuditLogService } from 'src/infra/audit/audit-log.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from 'src/infra/audit/audit.types';
import { PrismaService } from 'src/infra/database/prisma.service';
import { IPasswordHashingService } from 'src/security/interfaces/password-hashing.service.interface';
import { ORGANIZATION_MESSAGES } from '../organization.messages';
import {
  ProvisionOrganizationDto,
  ProvisionedOrganizationDto,
} from './dtos/provision-organization.dto';

@Injectable()
export class ProvisionOrganizationUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHashing: IPasswordHashingService,
    private readonly auditLog: IAuditLogService,
  ) {}

  async execute(
    dto: ProvisionOrganizationDto,
  ): Promise<ProvisionedOrganizationDto> {
    const email = dto.administrator.email.trim().toLowerCase();
    const taxId = dto.organization.taxId.replace(/\D/g, '');

    await this.assertAvailable(dto.organization.name, taxId, email);

    const passwordHash = await this.passwordHashing.hash(
      dto.administrator.password,
    );

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: dto.organization.name, taxId },
        select: { id: true, name: true, taxId: true },
      });

      const user = await tx.user.create({
        data: { email, password: passwordHash, type: 'PROFESSIONAL' },
        select: { id: true, email: true },
      });

      const professional = await tx.professional.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          fullName: dto.administrator.fullName,
          phoneNumber: dto.administrator.phoneNumber,
          profession: Profession.RECEPTIONIST,
        },
        select: { id: true },
      });

      await tx.professionalRole.create({
        data: {
          professionalId: professional.id,
          role: Role.ADMINISTRATOR,
          grantedById: professional.id,
        },
      });

      await this.auditLog.record(
        {
          userId: user.id,
          organizationId: organization.id,
          entityType: AUDIT_ENTITY_TYPES.ORGANIZATION,
          entityId: organization.id,
          action: AUDIT_ACTIONS.ORGANIZATION_PROVISIONED,
          newValues: {
            organizationName: organization.name,
            administratorUserId: user.id,
            administratorProfessionalId: professional.id,
          },
          changedFields: ['organization', 'administrator'],
        },
        tx,
      );

      return {
        organization,
        administrator: {
          userId: user.id,
          professionalId: professional.id,
          email: user.email,
          roles: [Role.ADMINISTRATOR],
        },
      };
    });
  }

  private async assertAvailable(
    name: string,
    taxId: string,
    email: string,
  ): Promise<void> {
    const [byName, byTaxId, byEmail] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { name },
        select: { id: true },
      }),
      this.prisma.organization.findUnique({
        where: { taxId },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      }),
    ]);

    if (byName) {
      throw new ConflictException(
        ORGANIZATION_MESSAGES.alreadyExists('name', name),
      );
    }

    if (byTaxId) {
      throw new ConflictException(
        ORGANIZATION_MESSAGES.alreadyExists('taxId', taxId),
      );
    }

    if (byEmail) {
      throw new ConflictException(
        ORGANIZATION_MESSAGES.administratorEmailTaken,
      );
    }
  }
}

import { Injectable } from '@nestjs/common';
import { AbilityBuilder } from '@casl/ability';
import { createPrismaAbility } from '@casl/prisma';
import { Role } from '@prisma/client';
import { AppAbility } from './ability.types';

export interface AbilityUser {
  id: string;
  organizationId: string;
  professionalId: string | null;
  roles: string[];
}

@Injectable()
export class AbilityFactory {
  createForUser(user: AbilityUser): AppAbility {
    const builder = new AbilityBuilder<AppAbility>(createPrismaAbility);

    for (const role of user.roles) {
      this.applyRole(role, user, builder);
    }

    return builder.build();
  }

  private applyRole(
    role: string,
    user: AbilityUser,
    { can }: AbilityBuilder<AppAbility>,
  ): void {
    const orgId = user.organizationId;

    const inOrg = { organizationId: orgId };
    const immunoInOrg = { patient: { organizationId: orgId } };
    const doseInOrg = { immunotherapy: { patient: { organizationId: orgId } } };
    const roleInOrg = { professional: { organizationId: orgId } };
    const userInOrg = { professional: { organizationId: orgId } };

    switch (role) {
      case Role.ADMINISTRATOR:
        can('read', 'Patient', inOrg);
        can('read', 'Immunotherapy', immunoInOrg);
        can('read', 'Dose', doseInOrg);
        can('manage', 'Professional', inOrg);
        can('manage', 'User', userInOrg);
        can('manage', 'InternalUserInvite', inOrg);
        can('manage', 'ProfessionalRole', roleInOrg);
        can('read', 'Organization', { id: orgId });
        break;

      case Role.PHYSICIAN:
        can('create', 'Patient', inOrg);
        if (user.professionalId) {
          const ownPatient = { responsiblePhysicianId: user.professionalId };
          can(['read', 'update', 'archive'], 'Patient', ownPatient);
          can('manage', 'Immunotherapy', { patient: ownPatient });
          can(['read', 'create', 'update'], 'Dose', {
            immunotherapy: { patient: ownPatient },
          });
        }
        can('read', 'Professional', inOrg);
        break;

      case Role.NURSE:
        can('read', 'Patient', inOrg);
        can('read', 'Immunotherapy', immunoInOrg);
        can(['read', 'create', 'update', 'archive'], 'Dose', doseInOrg);
        can('read', 'Professional', inOrg);
        break;

      case Role.RECEPTIONIST:
        can(['read', 'create', 'update'], 'Patient', inOrg);
        can('read', 'Professional', inOrg);
        break;
    }
  }
}

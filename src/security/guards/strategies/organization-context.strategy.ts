import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUserPayload, MembershipPayload } from '../../types/auth.types';
import { Request } from 'express';
import { IUserRepository } from 'src/account/profiles/domain/contracts/user.repository.interface';

export interface OrganizationContextStrategy {
  resolveContext(
    user: AuthenticatedUserPayload,
    userRepository: IUserRepository,
    request: Request,
  ): Promise<void>;
}

export class ProfessionalOrganizationContextStrategy implements OrganizationContextStrategy {
  async resolveContext(
    user: AuthenticatedUserPayload,
    userRepository: IUserRepository,
    request: Request,
  ): Promise<void> {
    const professionalUser = await userRepository.findUserById(user.id, user.activeOrgId); 

    if (!professionalUser?.organizationId) {
      throw new ForbiddenException('Usuário sem ID da organização');
    }
    user.activeOrgId = professionalUser.organizationId;
  }
}

export class AdminOrganizationContextStrategy implements OrganizationContextStrategy {
  async resolveContext(
    user: AuthenticatedUserPayload,
    userRepository: IUserRepository,
    request: Request,
  ): Promise<void> {
    // const adminUser = await userRepository.findUserById(user.id, user.activeOrgId); 

    if (!user.activeOrgId) {
      throw new ForbiddenException('Usuário sem ID da organização');
    }
  }
}

export class SystemAdminOrganizationContextStrategy implements OrganizationContextStrategy {
  async resolveContext(
    user: AuthenticatedUserPayload,
    userRepository: IUserRepository,
    request: Request,
  ): Promise<void> {
    // Super admin pode ter memberships ou não
    if (user.memberships && user.memberships.length > 0) {
      if (!user.activeOrgId) {
        // Se tem memberships mas não especificou, usa a primeira
        user.activeOrgId = user.memberships[0].organizationId;
      } else {
        // Valida se tem acesso
        const hasAccess = user.memberships.some(m => m.organizationId === user.activeOrgId);
        if (!hasAccess) {
          throw new ForbiddenException('Acesso negado a esta organização');
        }
      }
    }
    // Se não tem memberships, pode continuar sem activeOrgId
  }
}

export class PatientOrganizationContextStrategy implements OrganizationContextStrategy {
  async resolveContext(
    user: AuthenticatedUserPayload,
    userRepository: IUserRepository,
    request: Request,
  ): Promise<void> {
    if (!user.activeOrgId) {
      throw new ForbiddenException('Paciente sem organização ativa');
    }
    const activeMembership = user.memberships?.find((m) => m.organizationId === user.activeOrgId);

    if (!activeMembership) {
      throw new ForbiddenException('Vínculo organizacional inválido');
    }
    request.activeMembership = activeMembership as MembershipPayload;
  }
}


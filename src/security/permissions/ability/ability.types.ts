import { PrismaAbility, Subjects } from '@casl/prisma';
import {
  AuditLog,
  Dose,
  Immunotherapy,
  InternalUserInvite,
  Organization,
  Patient,
  Professional,
  ProfessionalRole,
  User,
} from '@prisma/client';

export type AppAction = 'manage' | 'create' | 'read' | 'update' | 'archive';

export type AppSubjects =
  | 'all'
  | Subjects<{
      User: User;
      Patient: Patient;
      Immunotherapy: Immunotherapy;
      Dose: Dose;
      Professional: Professional;
      Organization: Organization;
      InternalUserInvite: InternalUserInvite;
      ProfessionalRole: ProfessionalRole;
      AuditLog: AuditLog;
    }>;

export type AppAbility = PrismaAbility<[AppAction, AppSubjects]>;

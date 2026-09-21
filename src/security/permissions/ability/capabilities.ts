import { AppAbility, AppAction, AppSubjects } from './ability.types';

/**
 * Capacidades gerais anunciadas ao cliente. Elas habilitam ou escondem ações na
 * interface; a autorização por objeto continua sendo decidida no servidor a cada
 * comando, inclusive após locks.
 */
export const CAPABILITY_MATRIX: ReadonlyArray<{
  capability: string;
  action: AppAction;
  subject: AppSubjects;
}> = [
  { capability: 'patients:read', action: 'read', subject: 'Patient' },
  { capability: 'patients:create', action: 'create', subject: 'Patient' },
  { capability: 'patients:update', action: 'update', subject: 'Patient' },
  { capability: 'patients:archive', action: 'archive', subject: 'Patient' },
  {
    capability: 'immunotherapies:read',
    action: 'read',
    subject: 'Immunotherapy',
  },
  {
    capability: 'immunotherapies:create',
    action: 'create',
    subject: 'Immunotherapy',
  },
  {
    capability: 'immunotherapies:update',
    action: 'update',
    subject: 'Immunotherapy',
  },
  { capability: 'doses:read', action: 'read', subject: 'Dose' },
  { capability: 'doses:create', action: 'create', subject: 'Dose' },
  { capability: 'doses:update', action: 'update', subject: 'Dose' },
  { capability: 'doses:archive', action: 'archive', subject: 'Dose' },
  {
    capability: 'protocols:read',
    action: 'read',
    subject: 'TreatmentProtocol',
  },
  {
    capability: 'protocols:manage',
    action: 'manage',
    subject: 'TreatmentProtocol',
  },
  {
    capability: 'professionals:read',
    action: 'read',
    subject: 'Professional',
  },
  {
    capability: 'professionals:manage',
    action: 'manage',
    subject: 'Professional',
  },
  { capability: 'users:manage', action: 'manage', subject: 'User' },
  {
    capability: 'invites:manage',
    action: 'manage',
    subject: 'InternalUserInvite',
  },
  {
    capability: 'roles:manage',
    action: 'manage',
    subject: 'ProfessionalRole',
  },
  { capability: 'appointments:read', action: 'read', subject: 'Appointment' },
  {
    capability: 'appointments:manage',
    action: 'manage',
    subject: 'Appointment',
  },
  { capability: 'organization:read', action: 'read', subject: 'Organization' },
  { capability: 'auditLogs:read', action: 'read', subject: 'AuditLog' },
];

export function listCapabilities(ability: AppAbility): string[] {
  return CAPABILITY_MATRIX.filter((entry) =>
    ability.can(entry.action, entry.subject),
  ).map((entry) => entry.capability);
}

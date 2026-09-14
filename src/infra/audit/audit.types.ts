export const AUDIT_ACTIONS = {
  EMAIL_CHANGE_REQUESTED: 'EMAIL_CHANGE_REQUESTED',
  EMAIL_CHANGE_CONFIRMED: 'EMAIL_CHANGE_CONFIRMED',
  USER_EMAIL_CHANGED: 'USER_EMAIL_CHANGED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  USER_ARCHIVED: 'USER_ARCHIVED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_REACTIVATED: 'USER_REACTIVATED',

  ROLE_GRANTED: 'ROLE_GRANTED',
  ROLE_REVOKED: 'ROLE_REVOKED',

  PATIENT_ARCHIVED: 'PATIENT_ARCHIVED',
  IMMUNOTHERAPY_ARCHIVED: 'IMMUNOTHERAPY_ARCHIVED',
  DOSE_ARCHIVED: 'DOSE_ARCHIVED',

  INVITE_CREATED: 'INVITE_CREATED',
  INVITE_CANCELLED: 'INVITE_CANCELLED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ENTITY_TYPES = {
  USER: 'User',
  PROFESSIONAL: 'Professional',
  PATIENT: 'Patient',
  IMMUNOTHERAPY: 'Immunotherapy',
  DOSE: 'Dose',
  INTERNAL_USER_INVITE: 'InternalUserInvite',
  ORGANIZATION: 'Organization',
} as const;

export type AuditEntityType =
  (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES];

export interface AuditEntry {
  userId: string;
  organizationId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  changedFields?: string[];
  sessionId?: string;
}

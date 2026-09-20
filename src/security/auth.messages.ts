export const AUTH_MESSAGES = {
  invalidCredentials: 'Credenciais inválidas.',
  invalidOrExpiredResetToken: 'Token de redefinição inválido ou expirado.',
  resetTokenAlreadyUsed: 'Token de redefinição já utilizado.',
  sessionExpired: 'Sessão expirada.',
  sessionRevoked: 'Sessão encerrada.',
  sessionIdle: 'Sessão expirada por inatividade.',
  sessionNotFound: 'Sessão não encontrada.',
  forbidden: 'Acesso negado.',
  userNotAuthenticated: 'Usuário não autenticado.',
  organizationNotSet: 'Organização não definida para o usuário.',
  professionalWithoutOrganization: 'Profissional sem organização vinculada.',
  patientWithoutOrganization: 'Paciente sem organização vinculada.',
  accountDisabled: 'Conta desativada.',
  organizationDisabled: 'Organização desativada.',
  tooManyAttempts: 'Muitas tentativas. Tente novamente mais tarde.',
  csrfTokenMissing: 'Token CSRF ausente ou inválido.',
  originNotAllowed: 'Origem da requisição não permitida.',
  unsupportedContentType: 'Tipo de conteúdo não suportado para este comando.',
  legacyBearerDisabled: 'Autenticação por bearer não está disponível.',
  legacyBearerSecondFactorRequired:
    'Esta conta exige segundo fator; use o fluxo de sessão do aplicativo.',
  mfaRequired: 'Segundo fator obrigatório.',
  mfaChallengeInvalid: 'Desafio de segundo fator inválido ou expirado.',
  mfaCodeInvalid: 'Código de verificação inválido.',
  mfaCredentialNotFound: 'Credencial de segundo fator não encontrada.',
  mfaAlreadyConfirmed: 'Credencial de segundo fator já confirmada.',
  mfaKeyUnavailable:
    'Cadastro de segundo fator indisponível: chave de criptografia não configurada.',
  reauthenticationRequired: 'Confirme sua identidade para continuar.',
} as const;

/**
 * Códigos estáveis do envelope de erro. A UI ramifica por estes valores, nunca
 * pelo texto traduzido.
 */
export const AUTH_ERROR_CODES = {
  invalidCredentials: 'INVALID_CREDENTIALS',
  sessionExpired: 'SESSION_EXPIRED',
  sessionRevoked: 'SESSION_REVOKED',
  accountDisabled: 'ACCOUNT_DISABLED',
  organizationDisabled: 'ORGANIZATION_DISABLED',
  tooManyAttempts: 'TOO_MANY_ATTEMPTS',
  csrfInvalid: 'CSRF_TOKEN_INVALID',
  originNotAllowed: 'ORIGIN_NOT_ALLOWED',
  unsupportedContentType: 'UNSUPPORTED_CONTENT_TYPE',
  legacyBearerDisabled: 'LEGACY_BEARER_DISABLED',
  mfaRequired: 'MFA_REQUIRED',
  mfaEnrollmentRequired: 'MFA_ENROLLMENT_REQUIRED',
  mfaChallengeInvalid: 'MFA_CHALLENGE_INVALID',
  mfaCodeInvalid: 'MFA_CODE_INVALID',
  mfaUnavailable: 'MFA_UNAVAILABLE',
  reauthenticationRequired: 'REAUTHENTICATION_REQUIRED',
} as const;

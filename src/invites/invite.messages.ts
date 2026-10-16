export const INVITE_MESSAGES = {
  emailAlreadyActive: 'Já existe uma conta ativa com este e-mail.',
  userDisabled:
    'Este e-mail pertence a um usuário desativado ou arquivado. Reative o acesso do profissional em vez de emitir novo convite.',
  alreadyInvited: (email: string) =>
    `Já existe um convite ativo para ${email} nesta organização.`,
  notFound: 'Convite não encontrado.',
  resendNotAvailable:
    'Este convite não pode ser reenviado: já foi utilizado ou cancelado.',
} as const;

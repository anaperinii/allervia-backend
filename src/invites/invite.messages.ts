export const INVITE_MESSAGES = {
  emailAlreadyActive: 'Já existe uma conta ativa com este e-mail.',
  alreadyInvited: (email: string) =>
    `Já existe um convite ativo para ${email} nesta organização.`,
  notFound: (idOrToken: string) =>
    `Convite com ID ou token "${idOrToken}" não encontrado.`,
} as const;

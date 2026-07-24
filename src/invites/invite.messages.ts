export const INVITE_MESSAGES = {
  emailAlreadyActive:
    'Já existe um convite ativo para este email nesta organização.',
  notFound: (idOrToken: string) =>
    `Convite com ID ou token "${idOrToken}" não encontrado.`,
} as const;

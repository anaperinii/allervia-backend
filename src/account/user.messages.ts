export const USER_MESSAGES = {
  notFound: (id: string) => `Usuário com ID "${id}" não encontrado.`,
  invalidCurrentPassword: 'Senha atual incorreta.',
} as const;

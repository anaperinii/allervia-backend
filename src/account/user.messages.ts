export const USER_MESSAGES = {
  notFound: (id: string) => `Usuário com ID "${id}" não encontrado.`,
  invalidCurrentPassword: 'Senha atual incorreta.',
  passwordSameAsCurrent: 'A nova senha deve ser diferente da senha atual.',
} as const;

export const ROLE_MESSAGES = {
  notFound: (id: string) => `Concessão de role com ID "${id}" não encontrada.`,
  alreadyGranted: (role: string) =>
    `O profissional já possui a role "${role}".`,
  grantOutsideOrganization:
    'Papéis só podem ser concedidos dentro da própria organização.',
} as const;

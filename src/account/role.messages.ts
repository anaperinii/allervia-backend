export const ROLE_MESSAGES = {
  notFound: (id: string) => `Concessão de role com ID "${id}" não encontrada.`,
  alreadyGranted: (role: string) => `O profissional já possui a role "${role}".`,
  invalidBootstrapKey: 'Key de bootstrap inválida.',
} as const;

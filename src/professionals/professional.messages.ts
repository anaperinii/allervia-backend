export const PROFESSIONAL_MESSAGES = {
  notFound: (id: string) => `Profissional com ID "${id}" não encontrado.`,
  notFoundForUser: (userId: string) =>
    `Nenhum profissional vinculado ao usuário "${userId}".`,
} as const;

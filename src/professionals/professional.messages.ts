export const PROFESSIONAL_MESSAGES = {
  notFound: (id: string) => `Profissional com ID "${id}" não encontrado.`,
  notFoundForUser: (userId: string) =>
    `Nenhum profissional vinculado ao usuário "${userId}".`,
  professionIsManaged:
    'A profissão é mantida pela administração da organização.',
  cannotDisableSelf: 'Você não pode encerrar o seu próprio acesso.',
} as const;

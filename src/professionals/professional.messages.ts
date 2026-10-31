export const PROFESSIONAL_MESSAGES = {
  notFound: (id: string) => `Profissional com ID "${id}" não encontrado.`,
  notFoundForUser: (userId: string) =>
    `Nenhum profissional vinculado ao usuário "${userId}".`,
  professionIsManaged:
    'A profissão é mantida pela administração da organização.',
  cannotDisableSelf: 'Você não pode encerrar o seu próprio acesso.',
  channelRequired: 'Escolha o canal de envio do link de confirmação.',
  emailChangeRequestNotFound:
    'Pedido de troca de e-mail não encontrado ou já decidido.',
} as const;

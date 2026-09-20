export const ORGANIZATION_MESSAGES = {
  alreadyExists: (field: string, value: string) =>
    `Já existe uma organização com ${field} "${value}".`,
  notFound: (id: string) => `Organização com ID "${id}" não encontrada.`,
  administratorEmailTaken: 'Já existe uma conta com este e-mail.',
  provisioningKeyInvalid: 'Chave de provisionamento inválida.',
  provisioningUnavailable:
    'Provisionamento indisponível: chave administrativa não configurada.',
} as const;

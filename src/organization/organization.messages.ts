export const ORGANIZATION_MESSAGES = {
  alreadyExists: (field: string, value: string) =>
    `Já existe uma organização com ${field} "${value}".`,
  notFound: (id: string) => `Organização com ID "${id}" não encontrada.`,
} as const;

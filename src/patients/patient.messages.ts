export const PATIENT_MESSAGES = {
  notFound: (id: string) => `Paciente com ID "${id}" não encontrado.`,
  alreadyArchived: 'Paciente já está arquivado.',
} as const;

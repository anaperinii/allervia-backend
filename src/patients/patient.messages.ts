export const PATIENT_MESSAGES = {
  notFound: (id: string) => `Paciente com ID "${id}" não encontrado.`,
  alreadyArchived: 'Paciente já está arquivado.',
  cpfAlreadyRegistered: 'Já existe um paciente com este CPF nesta organização.',
  physicianNotFound: 'Médico responsável não encontrado nesta organização.',
} as const;

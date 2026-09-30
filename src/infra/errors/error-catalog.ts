export const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  ADJUSTMENT_REASON_REQUIRED: 'Informe o motivo do ajuste da dose.',
  ADMINISTRATION_BEFORE_INDUCTION_START:
    'A data e hora da administração são anteriores ao início do tratamento.',
  ADMINISTRATION_IN_FUTURE:
    'A data e hora da administração não podem estar no futuro.',
  ADMINISTRATION_OUT_OF_ORDER:
    'Já existe uma dose registrada com data e hora posteriores a esta. Registre as doses em ordem.',
  APPOINTMENT_ALREADY_CLOSED:
    'Este agendamento já foi encerrado e não pode mais ser alterado.',
  AUTOMATION_DISABLED:
    'A automação de protocolos está desativada para esta clínica. Fale com quem administra a conta.',
  CLINICAL_AUTHOR_REQUIRED: 'Apenas médicos podem realizar esta ação.',
  CLINICAL_TRANSITION_REVIEW_REQUIRED:
    'Este protocolo exige revisão clínica antes de ser usado.',
  CONCENTRATION_OUTSIDE_STORAGE_RANGE:
    'Concentração fora do intervalo aceito. Revise o valor informado.',
  CONDUCT_JUSTIFICATION_REQUIRED:
    'Informe a justificativa da conduta escolhida.',
  CONDUCT_REQUIRES_PHYSICIAN: 'Apenas médicos podem registrar esta conduta.',
  DOSE_ALREADY_SCHEDULED: 'Esta dose já possui um agendamento ativo.',
  DOSE_APPOINTMENT_REQUIRES_REVIEW:
    'Esta dose já teve um agendamento encerrado. Revise o histórico antes de agendar de novo.',
  DOSE_NOT_ADMINISTERED: 'Esta dose ainda não foi administrada.',
  DOSE_NOT_SCHEDULED: 'Esta dose não está agendada e não pode ser alterada.',
  DOSE_VALUES_REQUIRED: 'Informe os valores da dose.',
  GUARDIAN_NOT_ALLOWED_FOR_ADULT:
    'Paciente maior de idade não tem responsável legal. Remova os dados do responsável.',
  GUARDIAN_REQUIRED_FOR_MINOR:
    'Paciente menor de idade exige responsável legal. Informe nome e telefone do responsável.',
  DUPLICATE_OBSERVATION_PHASE:
    'Já existe uma observação registrada para esta fase. Use apenas uma por fase.',
  IDEMPOTENCY_KEY_REQUIRED:
    'Não foi possível concluir o envio. Recarregue a página e tente de novo.',
  IDEMPOTENCY_KEY_REUSED:
    'Este envio já foi processado com dados diferentes. Recarregue a página e confira antes de repetir.',
  INVALID_ADMINISTRATION_WINDOW:
    'O término da administração não pode ser anterior ao início.',
  INVALID_AS_OF:
    'Data de referência inválida. Use uma data que não esteja no futuro.',
  INVALID_DOSE_LINK:
    'A dose selecionada não está disponível para agendamento deste paciente.',
  INVALID_LIFECYCLE_TRANSITION:
    'Esta mudança de situação não é permitida a partir do estado atual do tratamento.',
  INVALID_OBSERVATION_TIME:
    'Horário da observação inválido. Deve ser posterior à administração e não pode estar no futuro.',
  INVALID_PERIOD: 'Período inválido. A data inicial deve ser anterior à final.',
  INVALID_TIME_ZONE: 'Fuso horário inválido.',
  LEGACY_TARGET_MISMATCH:
    'O protocolo escolhido não corresponde ao alvo do tratamento atual. Escolha outra versão.',
  MISS_BEFORE_START:
    'Não é possível marcar falta antes do horário do agendamento.',
  PATIENT_INACTIVE: 'Paciente inativo. Reative o cadastro para seguir.',
  PATIENT_NOT_FOUND: 'Paciente não encontrado.',
  PATIENT_XOR_PATIENT_ID_REQUIRED:
    'Informe um paciente já cadastrado ou os dados de um novo — não os dois.',
  PENDING_DOSE_REQUIRES_REVIEW:
    'O tratamento precisa ter exatamente uma dose agendada pendente para esta operação. Revise a agenda.',
  PERFORMER_NOT_AUTHORIZED:
    'O profissional informado não tem permissão para aplicar esta dose.',
  PRESCRIBER_MUST_BE_RESPONSIBLE_PHYSICIAN:
    'Ao cadastrar um novo paciente, o médico responsável deve ser você.',
  PRESCRIPTION_ALREADY_BOUND:
    'Este tratamento já está vinculado a uma prescrição de protocolo.',
  PRESCRIPTION_REVISION_REQUIRED:
    'Este campo só pode ser alterado por revisão de prescrição.',
  PRESCRIPTION_TIME_ZONE_REQUIRED:
    'A prescrição não tem fuso horário definido. Fale com quem administra a conta.',
  PROTOCOL_MANAGER_REQUIRED:
    'Apenas médicos ou administradores podem gerenciar protocolos.',
  PROTOCOL_MIGRATION_REQUIRED:
    'Este tratamento ainda usa o modelo antigo de protocolo. Migre para um protocolo configurável antes de seguir.',
  PUBLISHED_DEFAULT_REQUIRED:
    'Defina uma versão publicada como padrão para esta via de administração.',
  PUBLISHED_PROTOCOL_NOT_FOUND:
    'Protocolo publicado não encontrado para esta via de administração.',
  PUBLISHED_PROTOCOL_REQUIRED:
    'Nenhum protocolo padrão definido para esta via. Escolha uma versão ou defina um padrão.',
  PUBLISHED_VERSION_IMMUTABLE:
    'Versão já publicada não pode ser editada. Crie um novo rascunho.',
  PUBLISHED_VERSION_REQUIRED: 'Esta ação exige uma versão publicada.',
  RECOMMENDATIONS_ONLY_ON_COMPLETION:
    'Recomendações só podem ser registradas ao concluir o tratamento.',
  RESPONSIBLE_PHYSICIAN_NOT_FOUND:
    'Médico responsável não encontrado ou inativo.',
  RETURN_FORECAST_ONLY_ON_SUSPENSION:
    'Previsão de retorno só pode ser informada ao suspender o tratamento.',
  REVISION_TARGETS_SAME_VERSION:
    'A versão escolhida já é a que está em uso. Selecione outra.',
  SCHEDULE_REQUIRES_CALENDAR_REVIEW:
    'Não foi possível calcular a próxima data. Revise o calendário do protocolo.',
  STALE_APPOINTMENT_REVISION:
    'Este agendamento foi alterado por outra pessoa. Recarregue e tente de novo.',
  STALE_CLINICAL_REVISION:
    'Este registro foi alterado por outra pessoa. Recarregue e tente de novo.',
  STALE_PROTOCOL_REVISION:
    'Este protocolo foi alterado por outra pessoa. Recarregue e tente de novo.',
  STATUS_REASON_REQUIRED: 'Informe o motivo do cancelamento ou da falta.',
  SUCCESSOR_ALREADY_ADMINISTERED:
    'A dose seguinte já foi administrada. Não é possível corrigir esta.',
  TIMESTAMP_WITH_OFFSET_REQUIRED:
    'Data e hora em formato inválido. Recarregue a página e tente de novo.',
  TREATMENT_NOT_ACTIVE: 'Este tratamento não está ativo.',
  UNCHANGED_THERAPY_STATUS: 'O tratamento já está nessa situação.',
  UNSUPPORTED_AUTOMATION_ROUTE:
    'Via de administração ainda não suportada pela automação. Apenas subcutânea.',
  UNSUPPORTED_ROUTE:
    'Via de administração não suportada nesta operação. Apenas subcutânea.',
  VALUE_OUTSIDE_EXACT_STORAGE_RANGE:
    'Valor fora do intervalo aceito. Revise volume, concentração e intervalo.',

  VALIDATION_ERROR: 'Requisição inválida. Confira os campos destacados.',
  BAD_REQUEST: 'Requisição inválida.',
  UNAUTHENTICATED: 'Sessão expirada ou inválida. Entre novamente.',
  FORBIDDEN: 'Você não tem permissão para esta ação.',
  NOT_FOUND: 'Registro não encontrado.',
  METHOD_NOT_ALLOWED: 'Operação não permitida neste endereço.',
  CONFLICT: 'A operação conflita com o estado atual do registro.',
  ENDPOINT_RETIRED: 'Este recurso foi descontinuado. Atualize o aplicativo.',
  UNSUPPORTED_CONTENT_TYPE: 'Formato de conteúdo não suportado.',
  UNPROCESSABLE_ENTITY: 'Não foi possível processar os dados enviados.',
  TOO_MANY_ATTEMPTS: 'Muitas tentativas. Aguarde um instante e tente de novo.',
  SERVICE_UNAVAILABLE:
    'Serviço temporariamente indisponível. Tente de novo em instantes.',
  INTERNAL_ERROR: 'Erro interno ao processar a requisição.',
};

export function messageForCode(code: string): string | undefined {
  return ERROR_MESSAGES[code];
}

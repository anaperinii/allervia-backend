import type {
  RecommendationInput,
  StepResolution,
} from './protocol-definition';
import {
  normalizePositiveDecimal,
  positiveInteger,
  ProtocolValidationError,
  validateProtocolDefinition,
  validateResolvedPrescription,
} from './protocol-definition.validator';

export function resolveProtocolStep(
  input: RecommendationInput,
): StepResolution {
  let protocol: ReturnType<typeof validateProtocolDefinition>;
  let prescription: ReturnType<typeof validateResolvedPrescription>;
  try {
    protocol = validateProtocolDefinition(input.protocol);
  } catch (error) {
    if (!(error instanceof ProtocolValidationError)) throw error;
    return { kind: 'UNRESOLVED', code: 'INVALID_PROTOCOL' };
  }
  try {
    prescription = validateResolvedPrescription(input.prescription, protocol);
  } catch (error) {
    if (!(error instanceof ProtocolValidationError)) throw error;
    return { kind: 'UNRESOLVED', code: 'INVALID_PRESCRIPTION' };
  }
  const value = input.administered;
  if (!value || typeof value !== 'object')
    return { kind: 'UNRESOLVED', code: 'INVALID_ADMINISTERED_VALUES' };
  if (
    value.route !== protocol.route ||
    value.volumeUnit !== protocol.volumeUnit ||
    value.concentrationUnit !== protocol.concentrationUnit
  ) {
    return { kind: 'UNRESOLVED', code: 'CONTEXT_MISMATCH' };
  }
  let concentration: string;
  let volume: string;
  let intervalDays: number;
  try {
    concentration = normalizePositiveDecimal(value.concentration);
    volume = normalizePositiveDecimal(value.volume);
    intervalDays = positiveInteger(value.intervalDays, 'intervalDays');
    if (
      value.phase !== undefined &&
      value.phase !== 'BUILD_UP' &&
      value.phase !== 'MAINTENANCE'
    )
      throw new ProtocolValidationError('phase', 'Unsupported phase');
  } catch (error) {
    if (!(error instanceof ProtocolValidationError)) throw error;
    return { kind: 'UNRESOLVED', code: 'INVALID_ADMINISTERED_VALUES' };
  }
  const selected = new Set(prescription.stepIds);
  const matches = protocol.steps.filter(
    (step) =>
      selected.has(step.id) &&
      step.concentration === concentration &&
      step.volume === volume &&
      step.intervalDays === intervalDays &&
      (value.phase === undefined || step.phase === value.phase),
  );
  if (input.stepId !== undefined) {
    if (!selected.has(input.stepId))
      return { kind: 'UNRESOLVED', code: 'STEP_NOT_IN_PRESCRIPTION' };
    const step = matches.find((candidate) => candidate.id === input.stepId);
    return step
      ? { kind: 'RESOLVED', step }
      : { kind: 'UNRESOLVED', code: 'STEP_VALUE_MISMATCH' };
  }
  if (matches.length === 0)
    return { kind: 'UNRESOLVED', code: 'VALUE_NOT_CONFIGURED' };
  if (matches.length > 1)
    return { kind: 'UNRESOLVED', code: 'AMBIGUOUS_VALUE' };
  return { kind: 'RESOLVED', step: matches[0] };
}

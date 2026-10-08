import type {
  RecommendationInput,
  RecommendationResult,
} from './protocol-definition';
import { validateProtocolDefinition } from './protocol-definition.validator';
import { resolveProtocolStep } from './resolve-protocol-step';

export function recommendNextDose(
  input: RecommendationInput,
): RecommendationResult {
  const resolution = resolveProtocolStep(input);
  if (resolution.kind === 'UNRESOLVED') return resolution;
  const protocol = validateProtocolDefinition(input.protocol);
  const current = resolution.step;
  if (current.nextStepId === null) {
    return {
      kind: 'END_OF_SEQUENCE',
      protocolVersionId: protocol.versionId,
      fromStepId: current.id,
    };
  }
  const next = protocol.steps.find((step) => step.id === current.nextStepId)!;
  return {
    kind: 'RECOMMENDED',
    protocolVersionId: protocol.versionId,
    fromStepId: current.id,
    stepId: next.id,
    label: next.label,
    phase: next.phase,
    values: {
      concentration: next.concentration,
      volume: next.volume,
      intervalDays: next.intervalDays,
      phase: next.phase,
      route: protocol.route,
      volumeUnit: protocol.volumeUnit,
      concentrationUnit: protocol.concentrationUnit,
    },
  };
}

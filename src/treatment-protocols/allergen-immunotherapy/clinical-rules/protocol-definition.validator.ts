import type {
  PublishedProtocolDefinition,
  ProtocolStep,
  ResolvedPrescription,
} from './protocol-definition';

export class ProtocolValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'ProtocolValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new ProtocolValidationError(path, message);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, 'Expected an object');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    return fail(path, 'Expected a nonempty string without outer whitespace');
  }
  return value;
}

export function positiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return fail(path, 'Expected a positive safe integer');
  }
  return value;
}

export function normalizePositiveDecimal(
  value: unknown,
  path = 'value',
): string {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value)) {
    return fail(path, 'Expected a positive decimal string without exponent');
  }
  const [whole, fraction = ''] = value.split('.');
  const integer = whole.replace(/^0+(?=\d)/, '');
  const decimal = fraction.replace(/0+$/, '');
  if (integer === '0' && !decimal)
    return fail(path, 'Expected a value above zero');
  return decimal ? `${integer}.${decimal}` : integer;
}

export function validateProtocolDefinition(
  input: unknown,
): PublishedProtocolDefinition {
  const value = object(input, 'protocol');
  if (value.schemaVersion !== 1 || value.engineVersion !== '1') {
    return fail('protocol', 'Unsupported schema or engine version');
  }
  if (value.status !== 'PUBLISHED')
    return fail('protocol.status', 'Expected PUBLISHED');
  if (
    value.route !== 'SUBCUTANEOUS' ||
    value.volumeUnit !== 'mL' ||
    value.concentrationUnit !== 'DILUTION_DENOMINATOR'
  ) {
    return fail('protocol', 'Unsupported route or units');
  }
  if (!Array.isArray(value.steps) || value.steps.length === 0)
    return fail('protocol.steps', 'Expected at least one step');
  const steps: ProtocolStep[] = value.steps.map(
    (raw: unknown, index: number) => {
      const path = `protocol.steps[${index}]`;
      const step = object(raw, path);
      if (step.phase !== 'BUILD_UP' && step.phase !== 'MAINTENANCE')
        return fail(`${path}.phase`, 'Unsupported phase');
      return {
        id: text(step.id, `${path}.id`),
        label: text(step.label, `${path}.label`),
        phase: step.phase,
        concentration: normalizePositiveDecimal(
          step.concentration,
          `${path}.concentration`,
        ),
        volume: normalizePositiveDecimal(step.volume, `${path}.volume`),
        intervalDays: positiveInteger(
          step.intervalDays,
          `${path}.intervalDays`,
        ),
        nextStepId:
          step.nextStepId === null
            ? null
            : text(step.nextStepId, `${path}.nextStepId`),
      };
    },
  );
  const ids = new Set(steps.map((step) => step.id));
  if (ids.size !== steps.length)
    return fail('protocol.steps', 'Duplicate step IDs');
  for (const step of steps) {
    if (step.nextStepId !== null && !ids.has(step.nextStepId))
      return fail('protocol.steps', `Unknown successor for ${step.id}`);
  }
  return {
    schemaVersion: 1,
    engineVersion: '1',
    protocolId: text(value.protocolId, 'protocol.protocolId'),
    versionId: text(value.versionId, 'protocol.versionId'),
    version: positiveInteger(value.version, 'protocol.version'),
    status: 'PUBLISHED',
    route: value.route,
    volumeUnit: value.volumeUnit,
    concentrationUnit: value.concentrationUnit,
    steps,
  };
}

export function validateResolvedPrescription(
  input: unknown,
  protocol: PublishedProtocolDefinition,
): ResolvedPrescription {
  const value = object(input, 'prescription');
  if (
    value.protocolId !== protocol.protocolId ||
    value.protocolVersionId !== protocol.versionId ||
    value.route !== protocol.route
  ) {
    return fail('prescription', 'Protocol version or route mismatch');
  }
  if (!Array.isArray(value.stepIds) || value.stepIds.length === 0)
    return fail('prescription.stepIds', 'Expected a nonempty selection');
  const stepIds = value.stepIds.map((id: unknown) =>
    text(id, 'prescription.stepIds'),
  );
  const selected = new Set(stepIds);
  if (selected.size !== stepIds.length)
    return fail('prescription.stepIds', 'Duplicate IDs');
  const steps = new Map(protocol.steps.map((step) => [step.id, step]));
  for (const id of selected) {
    const step = steps.get(id);
    if (!step) return fail('prescription.stepIds', 'Unknown step');
    if (step.nextStepId !== null && !selected.has(step.nextStepId))
      return fail(
        'prescription.stepIds',
        'Successor outside the resolved prescription',
      );
  }
  const startingStepId = text(
    value.startingStepId,
    'prescription.startingStepId',
  );
  const targetStepId = text(value.targetStepId, 'prescription.targetStepId');
  if (!selected.has(startingStepId) || !selected.has(targetStepId))
    return fail('prescription', 'Start and target must be selected');
  const reachable = new Set<string>();
  let cursor: string | null = startingStepId;
  while (cursor !== null && !reachable.has(cursor)) {
    reachable.add(cursor);
    cursor = steps.get(cursor)!.nextStepId;
  }
  if (!reachable.has(targetStepId))
    return fail('prescription', 'Target is unreachable from the starting step');
  return {
    protocolId: protocol.protocolId,
    protocolVersionId: protocol.versionId,
    route: protocol.route,
    stepIds,
    startingStepId,
    targetStepId,
  };
}

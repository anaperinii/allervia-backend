import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  AdministeredDoseValues,
  PublishedProtocolDefinition,
  RecommendationInput,
  ResolvedPrescription,
  ProtocolStep,
} from './protocol-definition';
import {
  normalizePositiveDecimal,
  ProtocolValidationError,
  validateProtocolDefinition,
  validateResolvedPrescription,
} from './protocol-definition.validator';
import { recommendNextDose } from './recommend-next-dose';
import { resolveProtocolStep } from './resolve-protocol-step';

type AcceptanceCase = {
  id: string;
  stage: number;
  administeredStepId?: string;
  expectedNextStepId?: string;
  replacementLabel?: string;
  historyLengthsForTestHarness?: number[];
  administeredValues?: {
    concentration: number;
    volume: string;
    intervalDays: number;
  };
  expectedResolution?: string;
};
const fixture = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      '../../../../test/fixtures/configurable-immunotherapy.acceptance.json',
    ),
    'utf8',
  ),
) as {
  steps: (Omit<ProtocolStep, 'concentration'> & { concentration: number })[];
  cases: AcceptanceCase[];
};

function protocol(): PublishedProtocolDefinition {
  return {
    schemaVersion: 1,
    engineVersion: '1',
    protocolId: 'synthetic',
    versionId: 'synthetic-v1',
    version: 1,
    status: 'PUBLISHED',
    route: 'SUBCUTANEOUS',
    volumeUnit: 'mL',
    concentrationUnit: 'DILUTION_DENOMINATOR',
    steps: fixture.steps.map((step) => ({
      ...step,
      concentration: String(step.concentration),
    })),
  };
}
function prescription(config = protocol()): ResolvedPrescription {
  return {
    protocolId: config.protocolId,
    protocolVersionId: config.versionId,
    route: config.route,
    stepIds: config.steps.map((step) => step.id),
    startingStepId: config.steps[0].id,
    targetStepId: config.steps[config.steps.length - 1].id,
  };
}
function input(
  stepId = 'build-up-1000-020',
  config = protocol(),
): RecommendationInput {
  const step = config.steps.find((value) => value.id === stepId)!;
  return {
    protocol: config,
    prescription: prescription(config),
    administered: {
      concentration: step.concentration,
      volume: step.volume,
      intervalDays: step.intervalDays,
      route: config.route,
      volumeUnit: config.volumeUnit,
      concentrationUnit: config.concentrationUnit,
    },
  };
}
function withSteps(
  steps: readonly ProtocolStep[],
): PublishedProtocolDefinition {
  return { ...protocol(), steps };
}
function unresolved(value: RecommendationInput, code: string) {
  expect(resolveProtocolStep(value)).toEqual({ kind: 'UNRESOLVED', code });
  expect(recommendNextDose(value)).toEqual({ kind: 'UNRESOLVED', code });
}

describe('configured protocol acceptance fixtures (stage 1)', () => {
  it.each(fixture.cases.filter((test) => test.stage === 1))('$id', (test) => {
    let config = protocol();
    if (test.replacementLabel)
      config = {
        ...config,
        steps: config.steps.map((step) => ({
          ...step,
          label: test.replacementLabel!,
        })),
      };
    const base = input(test.administeredStepId, config);
    if (test.administeredValues) {
      unresolved(
        {
          ...base,
          administered: {
            ...base.administered,
            ...test.administeredValues,
            concentration: String(test.administeredValues.concentration),
          },
        },
        'VALUE_NOT_CONFIGURED',
      );
      return;
    }
    // Histories belong to this harness, never to the engine's input contract.
    for (const length of test.historyLengthsForTestHarness ?? [1]) {
      const history = Array.from({ length }, () => base.administered);
      const result = recommendNextDose({
        ...base,
        administered: history[history.length - 1],
      });
      expect(result).toMatchObject({
        kind: 'RECOMMENDED',
        fromStepId: test.administeredStepId,
        stepId: test.expectedNextStepId,
        protocolVersionId: config.versionId,
      });
    }
  });

  it('recognizes an edited lower value and recommends from it after administration', () => {
    const original = input('build-up-1000-040');
    const edited = {
      ...original,
      administered: { ...original.administered, volume: '0.2' },
    };
    expect(resolveProtocolStep(edited)).toMatchObject({
      kind: 'RESOLVED',
      step: { id: 'build-up-1000-020' },
    });
    expect(recommendNextDose(edited)).toMatchObject({
      kind: 'RECOMMENDED',
      stepId: 'build-up-1000-040',
    });
    expect(recommendNextDose(original)).toMatchObject({
      kind: 'RECOMMENDED',
      stepId: 'build-up-1000-080',
    });
  });

  it('permits any configured value, including a jump forward or different concentration', () => {
    expect(resolveProtocolStep(input('build-up-100-040'))).toMatchObject({
      kind: 'RESOLVED',
      step: { id: 'build-up-100-040' },
    });
  });
});

describe('exact decimal representation', () => {
  it.each([
    ['000.2000', '0.2'],
    ['001000.000', '1000'],
    [
      '9007199254740993.0000000000000000010',
      '9007199254740993.000000000000000001',
    ],
    ['0.00000000000000000001', '0.00000000000000000001'],
  ])('normalizes %s without precision loss', (raw, expected) => {
    expect(normalizePositiveDecimal(raw)).toBe(expected);
  });
  it.each([
    0.2,
    NaN,
    Infinity,
    '',
    '0',
    '0.000',
    '-1',
    '+1',
    '1e-3',
    '0,2',
    ' 0.2',
    '.2',
    '1.',
    null,
    undefined,
  ])('rejects invalid decimal %s', (raw) => {
    expect(() => normalizePositiveDecimal(raw)).toThrow(
      ProtocolValidationError,
    );
  });
  it('matches equivalent representations and returns normalized configured values', () => {
    const base = input();
    const edited = {
      ...base,
      administered: {
        ...base.administered,
        volume: '000.2000',
        concentration: '01000.00',
      },
    };
    expect(recommendNextDose(edited)).toMatchObject({
      kind: 'RECOMMENDED',
      values: { volume: '0.4', concentration: '1000' },
    });
  });
  it('never rounds a nearby value to an existing step', () => {
    const base = input();
    unresolved(
      {
        ...base,
        administered: {
          ...base.administered,
          volume: '0.20000000000000000001',
        },
      },
      'VALUE_NOT_CONFIGURED',
    );
  });
});

describe('protocol publication validation', () => {
  it('accepts the synthetic published protocol and does not mutate it', () => {
    const config = protocol();
    const before = structuredClone(config);
    expect(validateProtocolDefinition(config)).toEqual(config);
    expect(config).toEqual(before);
  });
  it.each([
    ['schemaVersion', 2],
    ['engineVersion', '2'],
    ['status', 'DRAFT'],
    ['route', 'SUBLINGUAL'],
    ['volumeUnit', 'drops'],
    ['concentrationUnit', 'UNKNOWN'],
    ['version', 0],
    ['version', 1.5],
    ['protocolId', ''],
    ['versionId', ' '],
    ['steps', []],
    ['steps', null],
  ])('rejects invalid protocol field %s = %s', (field, value) => {
    expect(() =>
      validateProtocolDefinition({ ...protocol(), [field]: value }),
    ).toThrow(ProtocolValidationError);
    unresolved(
      {
        ...input(),
        protocol: {
          ...protocol(),
          [field]: value,
        } as PublishedProtocolDefinition,
      },
      'INVALID_PROTOCOL',
    );
  });
  it.each([
    ['id', ''],
    ['label', ''],
    ['phase', 'UNKNOWN'],
    ['concentration', '0'],
    ['volume', '0'],
    ['volume', 0.2],
    ['intervalDays', 0],
    ['intervalDays', -7],
    ['intervalDays', 1.5],
    ['intervalDays', Number.MAX_SAFE_INTEGER + 1],
    ['nextStepId', undefined],
    ['nextStepId', 'missing'],
  ])('rejects invalid step field %s = %s', (field, value) => {
    const config = protocol();
    expect(() =>
      validateProtocolDefinition({
        ...config,
        steps: config.steps.map((step, index) =>
          index === 0 ? { ...step, [field]: value } : step,
        ),
      }),
    ).toThrow(ProtocolValidationError);
  });
  it('rejects duplicate IDs while allowing duplicate labels', () => {
    const config = protocol();
    expect(() =>
      validateProtocolDefinition({
        ...config,
        steps: [...config.steps, config.steps[0]],
      }),
    ).toThrow(ProtocolValidationError);
    expect(() =>
      validateProtocolDefinition({
        ...config,
        steps: config.steps.map((step) => ({ ...step, label: 'Shared label' })),
      }),
    ).not.toThrow();
  });
  it.each([null, undefined, [], 'protocol'])(
    'rejects malformed objects %s',
    (value) => {
      expect(() => validateProtocolDefinition(value)).toThrow(
        ProtocolValidationError,
      );
    },
  );
});

describe('resolved prescription validation', () => {
  it.each([
    ['protocolId', 'another'],
    ['protocolVersionId', 'v2'],
    ['route', 'SUBLINGUAL'],
    ['stepIds', []],
    ['stepIds', ['unknown']],
    ['startingStepId', 'unknown'],
    ['targetStepId', 'unknown'],
  ])('rejects an incompatible prescription %s', (field, value) => {
    const base = input();
    unresolved(
      {
        ...base,
        prescription: {
          ...base.prescription,
          [field]: value,
        } as ResolvedPrescription,
      },
      'INVALID_PRESCRIPTION',
    );
  });
  it('rejects a duplicate selection', () => {
    const base = input();
    expect(() =>
      validateResolvedPrescription(
        {
          ...base.prescription,
          stepIds: [...base.prescription.stepIds, base.prescription.stepIds[0]],
        },
        base.protocol,
      ),
    ).toThrow(ProtocolValidationError);
  });
  it('rejects a successor outside the prescribed selection instead of skipping it', () => {
    const base = input();
    unresolved(
      {
        ...base,
        prescription: {
          ...base.prescription,
          stepIds: base.prescription.stepIds.filter(
            (id) => id !== 'build-up-1000-040',
          ),
        },
      },
      'INVALID_PRESCRIPTION',
    );
  });
  it('recognizes an allowed alternative outside the default path', () => {
    const config = protocol();
    const alternative: ProtocolStep = {
      ...config.steps[0],
      id: 'alternative-volume',
      label: 'Alternative configured value',
      volume: '0.3',
      nextStepId: 'build-up-1000-040',
    };
    const extended = { ...config, steps: [...config.steps, alternative] };
    const base = {
      ...input(alternative.id, extended),
      prescription: {
        ...prescription(config),
        stepIds: [...prescription(config).stepIds, alternative.id],
      },
    };
    expect(resolveProtocolStep(base)).toMatchObject({
      kind: 'RESOLVED',
      step: { id: alternative.id },
    });
    expect(recommendNextDose(base)).toMatchObject({
      kind: 'RECOMMENDED',
      stepId: 'build-up-1000-040',
    });
  });

  it('rejects an unreachable target even when the target exists', () => {
    const config = protocol();
    const broken = {
      ...config,
      steps: config.steps.map((step, index) =>
        index === 0 ? { ...step, nextStepId: step.id } : step,
      ),
    };
    unresolved(input('build-up-1000-020', broken), 'INVALID_PRESCRIPTION');
  });
  it('allows a resolved subsequence and rejects values outside it', () => {
    const base = input();
    const scoped = {
      ...base,
      prescription: {
        ...base.prescription,
        startingStepId: 'build-up-100-010',
        stepIds: base.prescription.stepIds.slice(4),
      },
    };
    expect(() =>
      validateResolvedPrescription(scoped.prescription, scoped.protocol),
    ).not.toThrow();
    unresolved(scoped, 'VALUE_NOT_CONFIGURED');
    unresolved(
      { ...scoped, stepId: 'build-up-1000-020' },
      'STEP_NOT_IN_PRESCRIPTION',
    );
  });
});

describe('step resolution and recommendations', () => {
  it('rejects a stale planned ID paired with an edited value', () => {
    unresolved(
      { ...input(), stepId: 'build-up-1000-040' },
      'STEP_VALUE_MISMATCH',
    );
  });
  it('rejects an unknown ID rather than falling back to a matching value', () => {
    unresolved({ ...input(), stepId: 'unknown' }, 'STEP_NOT_IN_PRESCRIPTION');
  });
  it.each([
    ['route', 'SUBLINGUAL'],
    ['volumeUnit', 'drops'],
    ['concentrationUnit', 'mg/mL'],
  ])('rejects context mismatch for %s', (key, value) => {
    const base = input();
    unresolved(
      {
        ...base,
        administered: {
          ...base.administered,
          [key]: value,
        } as AdministeredDoseValues,
      },
      'CONTEXT_MISMATCH',
    );
  });
  it.each([
    ['volume', '0'],
    ['concentration', 1000],
    ['intervalDays', 0],
    ['phase', 'UNKNOWN'],
  ])('rejects invalid administered %s', (key, value) => {
    const base = input();
    unresolved(
      {
        ...base,
        administered: {
          ...base.administered,
          [key]: value,
        } as AdministeredDoseValues,
      },
      'INVALID_ADMINISTERED_VALUES',
    );
  });
  it('uses nominal interval as part of the configured value', () => {
    const base = input('build-up-100-050');
    expect(resolveProtocolStep(base)).toMatchObject({
      kind: 'RESOLVED',
      step: { phase: 'BUILD_UP' },
    });
    expect(
      resolveProtocolStep({
        ...base,
        administered: { ...base.administered, intervalDays: 14 },
      }),
    ).toMatchObject({ kind: 'RESOLVED', step: { phase: 'MAINTENANCE' } });
  });
  it('reports ambiguity and accepts a matching ID or phase to resolve it', () => {
    const first = { ...protocol().steps[0], id: 'a', nextStepId: 'b' };
    const last = {
      ...first,
      id: 'b',
      phase: 'MAINTENANCE' as const,
      nextStepId: null,
    };
    const base = input('a', withSteps([first, last]));
    unresolved(base, 'AMBIGUOUS_VALUE');
    expect(recommendNextDose({ ...base, stepId: 'a' })).toMatchObject({
      kind: 'RECOMMENDED',
      stepId: 'b',
    });
    expect(
      recommendNextDose({
        ...base,
        administered: { ...base.administered, phase: 'MAINTENANCE' },
      }),
    ).toEqual({
      kind: 'END_OF_SEQUENCE',
      fromStepId: 'b',
      protocolVersionId: 'synthetic-v1',
    });
    unresolved(
      {
        ...base,
        stepId: 'a',
        administered: { ...base.administered, phase: 'MAINTENANCE' },
      },
      'STEP_VALUE_MISMATCH',
    );
  });
  it('does not use array order, arithmetic or the label as the transition rule', () => {
    const config = protocol();
    const altered = {
      ...config,
      steps: [...config.steps]
        .reverse()
        .map((step) =>
          step.id === 'build-up-1000-040' ? { ...step, volume: '0.375' } : step,
        ),
    };
    const base = { ...input(), protocol: altered };
    expect(recommendNextDose(base)).toMatchObject({
      kind: 'RECOMMENDED',
      stepId: 'build-up-1000-040',
      values: { volume: '0.375' },
    });
  });
  it('repeats only through an explicit self-transition', () => {
    const base = input('maintenance-100-050-14');
    const result = recommendNextDose(base);
    expect(result).toMatchObject({
      kind: 'RECOMMENDED',
      stepId: 'maintenance-100-050-14',
      values: { intervalDays: 14 },
    });
  });
  it('returns explicit end of sequence, with no implicit repetition', () => {
    const last = { ...protocol().steps[0], nextStepId: null };
    expect(recommendNextDose(input(last.id, withSteps([last])))).toEqual({
      kind: 'END_OF_SEQUENCE',
      fromStepId: last.id,
      protocolVersionId: 'synthetic-v1',
    });
  });
  it('does not mutate inputs and produces detached values', () => {
    const base = input();
    const before = structuredClone(base);
    const result = recommendNextDose(base);
    expect(base).toEqual(before);
    if (result.kind !== 'RECOMMENDED')
      throw new Error('Expected recommendation');
    expect(result.values).not.toBe(base.protocol.steps[2]);
    expect(recommendNextDose(base)).toEqual(result);
  });
});

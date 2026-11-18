import type {
  ProtocolStep,
  PublishedProtocolDefinition,
  StepIntervalTolerance,
} from './protocol-definition';

export const DOSE_INTERVAL_BANDS = [
  'TOO_SHORT',
  'ON_PLAN',
  'LONG',
  'REQUIRES_STEP_REVIEW',
] as const;

export type DoseIntervalBand = (typeof DOSE_INTERVAL_BANDS)[number];

export type { StepIntervalTolerance };

export interface StepIntervalContext {
  intervalDays: number;
  followingIntervalDays: number | null;
  tolerance?: StepIntervalTolerance | null;
}

export interface DoseIntervalAssessment {
  band: DoseIntervalBand;
  actualIntervalDays: number;
  tolerance: StepIntervalTolerance;
  toleranceSource: 'PROTOCOL' | 'DERIVED';
  justificationRequired: boolean;
}

export function resolveStepIntervalTolerance(context: StepIntervalContext): {
  tolerance: StepIntervalTolerance;
  source: 'PROTOCOL' | 'DERIVED';
} {
  assertInterval(context.intervalDays);

  if (context.tolerance) {
    return {
      tolerance: normalize(context.tolerance, context.intervalDays),
      source: 'PROTOCOL',
    };
  }

  const following = context.followingIntervalDays ?? context.intervalDays;
  assertInterval(following);

  return {
    tolerance: normalize(
      {
        shortBelowDays:
          context.intervalDays - Math.floor(context.intervalDays / 2),
        longFromDays: context.intervalDays + Math.floor(following / 2),
        stepReviewAboveDays: context.intervalDays + following,
      },
      context.intervalDays,
    ),
    source: 'DERIVED',
  };
}

export function stepIntervalContext(
  protocol: PublishedProtocolDefinition,
  step: ProtocolStep,
): StepIntervalContext {
  const following =
    step.nextStepId === null
      ? null
      : (protocol.steps.find((candidate) => candidate.id === step.nextStepId) ??
        null);

  return {
    intervalDays: step.intervalDays,
    followingIntervalDays: following?.intervalDays ?? null,
    tolerance: step.intervalTolerance ?? null,
  };
}

export function classifyDoseInterval(
  context: StepIntervalContext,
  actualIntervalDays: number,
): DoseIntervalAssessment {
  const { tolerance, source } = resolveStepIntervalTolerance(context);
  const band = bandFor(actualIntervalDays, tolerance);

  return {
    band,
    actualIntervalDays,
    tolerance,
    toleranceSource: source,
    justificationRequired:
      band === 'TOO_SHORT' || band === 'REQUIRES_STEP_REVIEW',
  };
}

function bandFor(
  actualIntervalDays: number,
  tolerance: StepIntervalTolerance,
): DoseIntervalBand {
  if (actualIntervalDays < tolerance.shortBelowDays) return 'TOO_SHORT';
  if (actualIntervalDays > tolerance.stepReviewAboveDays)
    return 'REQUIRES_STEP_REVIEW';
  if (actualIntervalDays >= tolerance.longFromDays) return 'LONG';
  return 'ON_PLAN';
}

function normalize(
  tolerance: StepIntervalTolerance,
  intervalDays: number,
): StepIntervalTolerance {
  const shortBelowDays = clamp(tolerance.shortBelowDays, 1, intervalDays);
  const longFromDays = Math.max(tolerance.longFromDays, intervalDays + 1);
  const stepReviewAboveDays = Math.max(
    tolerance.stepReviewAboveDays,
    longFromDays,
  );
  return { shortBelowDays, longFromDays, stepReviewAboveDays };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function assertInterval(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new RangeError('Invalid protocol interval');
}

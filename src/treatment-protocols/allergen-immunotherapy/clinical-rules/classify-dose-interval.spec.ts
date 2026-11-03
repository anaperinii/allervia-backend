import {
  classifyDoseInterval,
  resolveStepIntervalTolerance,
  stepIntervalContext,
} from './classify-dose-interval';
import type {
  ProtocolStep,
  PublishedProtocolDefinition,
} from './protocol-definition';

function protocol(steps: ProtocolStep[]): PublishedProtocolDefinition {
  return {
    schemaVersion: 1,
    engineVersion: '1',
    protocolId: 'protocol-1',
    versionId: 'version-1',
    version: 1,
    status: 'PUBLISHED',
    route: 'SUBCUTANEOUS',
    volumeUnit: 'mL',
    concentrationUnit: 'DILUTION_DENOMINATOR',
    steps,
  };
}

function step(overrides: Partial<ProtocolStep> = {}): ProtocolStep {
  return {
    id: 'low',
    label: 'Low',
    phase: 'BUILD_UP',
    concentration: '1000',
    volume: '0.1',
    intervalDays: 7,
    nextStepId: 'high',
    ...overrides,
  };
}

function bands(context: Parameters<typeof classifyDoseInterval>[0], upTo: number) {
  return Array.from({ length: upTo }, (_, index) =>
    classifyDoseInterval(context, index + 1).band,
  );
}

describe('Classificação do intervalo entre doses (RNE-010)', () => {
  describe('tolerância autorada no protocolo', () => {
    const authored = {
      intervalDays: 7,
      followingIntervalDays: 7,
      tolerance: {
        shortBelowDays: 5,
        longFromDays: 10,
        stepReviewAboveDays: 14,
      },
    };

    it('reproduz as faixas da RNE-010 para indução de 7 dias', () => {
      expect(bands(authored, 18)).toEqual([
        'TOO_SHORT',
        'TOO_SHORT',
        'TOO_SHORT',
        'TOO_SHORT',
        'ON_PLAN',
        'ON_PLAN',
        'ON_PLAN',
        'ON_PLAN',
        'ON_PLAN',
        'LONG',
        'LONG',
        'LONG',
        'LONG',
        'LONG',
        'REQUIRES_STEP_REVIEW',
        'REQUIRES_STEP_REVIEW',
        'REQUIRES_STEP_REVIEW',
        'REQUIRES_STEP_REVIEW',
      ]);
    });

    it('exige justificativa só nas pontas', () => {
      expect(classifyDoseInterval(authored, 4).justificationRequired).toBe(true);
      expect(classifyDoseInterval(authored, 7).justificationRequired).toBe(
        false,
      );
      expect(classifyDoseInterval(authored, 12).justificationRequired).toBe(
        false,
      );
      expect(classifyDoseInterval(authored, 21).justificationRequired).toBe(
        true,
      );
    });

    it('marca a origem da tolerância', () => {
      expect(classifyDoseInterval(authored, 7).toleranceSource).toBe(
        'PROTOCOL',
      );
    });
  });

  describe('derivação a partir do grafo, sem tolerância autorada', () => {
    it('tira os limites do passo e do seguinte', () => {
      const { tolerance, source } = resolveStepIntervalTolerance({
        intervalDays: 7,
        followingIntervalDays: 7,
      });
      expect(source).toBe('DERIVED');
      expect(tolerance).toEqual({
        shortBelowDays: 4,
        longFromDays: 10,
        stepReviewAboveDays: 14,
      });
    });

    it('acompanha um passo seguinte mais longo', () => {
      const { tolerance } = resolveStepIntervalTolerance({
        intervalDays: 7,
        followingIntervalDays: 28,
      });
      expect(tolerance).toEqual({
        shortBelowDays: 4,
        longFromDays: 21,
        stepReviewAboveDays: 35,
      });
    });

    it('escala para manutenção sem reusar números da indução', () => {
      const { tolerance } = resolveStepIntervalTolerance({
        intervalDays: 28,
        followingIntervalDays: 28,
      });
      expect(tolerance).toEqual({
        shortBelowDays: 14,
        longFromDays: 42,
        stepReviewAboveDays: 56,
      });
    });

    it('usa o próprio intervalo quando o passo encerra a sequência', () => {
      const { tolerance } = resolveStepIntervalTolerance({
        intervalDays: 14,
        followingIntervalDays: null,
      });
      expect(tolerance).toEqual({
        shortBelowDays: 7,
        longFromDays: 21,
        stepReviewAboveDays: 28,
      });
    });

    it('mantém as faixas ordenadas mesmo em intervalos degenerados', () => {
      const { tolerance } = resolveStepIntervalTolerance({
        intervalDays: 1,
        followingIntervalDays: 1,
      });
      expect(tolerance.shortBelowDays).toBeLessThanOrEqual(1);
      expect(tolerance.longFromDays).toBeGreaterThan(1);
      expect(tolerance.stepReviewAboveDays).toBeGreaterThanOrEqual(
        tolerance.longFromDays,
      );
      expect(classifyDoseInterval({ intervalDays: 1, followingIntervalDays: 1 }, 1).band).toBe('ON_PLAN');
    });
  });

  describe('contexto montado a partir do protocolo', () => {
    it('lê o intervalo do passo seguinte pelo grafo', () => {
      const definition = protocol([
        step(),
        step({
          id: 'high',
          label: 'High',
          phase: 'MAINTENANCE',
          intervalDays: 28,
          nextStepId: 'high',
        }),
      ]);
      expect(stepIntervalContext(definition, definition.steps[0])).toEqual({
        intervalDays: 7,
        followingIntervalDays: 28,
        tolerance: null,
      });
    });

    it('prefere a tolerância autorada no passo', () => {
      const tolerance = {
        shortBelowDays: 5,
        longFromDays: 10,
        stepReviewAboveDays: 14,
      };
      const definition = protocol([
        step({ intervalTolerance: tolerance, nextStepId: null }),
      ]);
      expect(
        stepIntervalContext(definition, definition.steps[0]).tolerance,
      ).toEqual(tolerance);
    });
  });

  it('recusa intervalos de protocolo inválidos', () => {
    expect(() =>
      resolveStepIntervalTolerance({
        intervalDays: 0,
        followingIntervalDays: 7,
      }),
    ).toThrow(RangeError);
  });
});

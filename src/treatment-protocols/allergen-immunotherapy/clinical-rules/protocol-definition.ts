export type DoseValues = Readonly<{
  concentration: string;
  volume: string;
  intervalDays: number;
}>;

export type ProtocolStep = DoseValues &
  Readonly<{
    id: string;
    label: string;
    phase: 'BUILD_UP' | 'MAINTENANCE';
    nextStepId: string | null;
  }>;

export type PublishedProtocolDefinition = Readonly<{
  schemaVersion: 1;
  engineVersion: '1';
  protocolId: string;
  versionId: string;
  version: number;
  status: 'PUBLISHED';
  route: 'SUBCUTANEOUS';
  volumeUnit: 'mL';
  concentrationUnit: 'DILUTION_DENOMINATOR';
  steps: readonly ProtocolStep[];
}>;

export type ResolvedPrescription = Readonly<{
  protocolId: string;
  protocolVersionId: string;
  route: PublishedProtocolDefinition['route'];
  stepIds: readonly string[];
  startingStepId: string;
  targetStepId: string;
}>;

export type AdministeredDoseValues = DoseValues &
  Readonly<{
    route: PublishedProtocolDefinition['route'];
    volumeUnit: PublishedProtocolDefinition['volumeUnit'];
    concentrationUnit: PublishedProtocolDefinition['concentrationUnit'];
    phase?: ProtocolStep['phase'];
  }>;

export type RecommendationInput = Readonly<{
  protocol: PublishedProtocolDefinition;
  prescription: ResolvedPrescription;
  administered: AdministeredDoseValues;
  stepId?: string;
}>;

export type UnresolvedCode =
  | 'INVALID_PROTOCOL'
  | 'INVALID_PRESCRIPTION'
  | 'INVALID_ADMINISTERED_VALUES'
  | 'CONTEXT_MISMATCH'
  | 'STEP_NOT_IN_PRESCRIPTION'
  | 'STEP_VALUE_MISMATCH'
  | 'VALUE_NOT_CONFIGURED'
  | 'AMBIGUOUS_VALUE';

export type UnresolvedResult = Readonly<{
  kind: 'UNRESOLVED';
  code: UnresolvedCode;
}>;

export type StepResolution =
  | { kind: 'RESOLVED'; step: ProtocolStep }
  | UnresolvedResult;

export type RecommendationResult =
  | {
      kind: 'RECOMMENDED';
      protocolVersionId: string;
      fromStepId: string;
      stepId: string;
      label: string;
      phase: ProtocolStep['phase'];
      values: AdministeredDoseValues;
    }
  | { kind: 'END_OF_SEQUENCE'; protocolVersionId: string; fromStepId: string }
  | UnresolvedResult;

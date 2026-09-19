export function syntheticProtocolDefinition() {
  return {
    schemaVersion: 1,
    engineVersion: '1',
    route: 'SUBCUTANEOUS',
    volumeUnit: 'mL',
    concentrationUnit: 'DILUTION_DENOMINATOR',
    steps: [
      {
        id: 'low',
        label: 'Low',
        phase: 'BUILD_UP',
        concentration: '1000',
        volume: '0.1',
        intervalDays: 7,
        nextStepId: 'middle',
      },
      {
        id: 'middle',
        label: 'Middle',
        phase: 'BUILD_UP',
        concentration: '1000',
        volume: '0.2',
        intervalDays: 7,
        nextStepId: 'high',
      },
      {
        id: 'high',
        label: 'High',
        phase: 'MAINTENANCE',
        concentration: '1000',
        volume: '0.4',
        intervalDays: 14,
        nextStepId: 'high',
      },
    ],
  };
}

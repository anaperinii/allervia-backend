export const STARTING_DOSE_CONCENTRATION = 10000;
export const STARTING_DOSE_VOLUME = 0.1;
export const BUILD_UP_INTERVAL = 7;

export type NextDoseCalculation = {
  nextConcentration: number;
  nextVolume: number;
};

import type { Config } from 'jest';
import baseConfig from './jest.shared.cjs';

const config: Config = {
  ...(baseConfig as Config),
  collectCoverage: false,
  setupFiles: ['<rootDir>/test/setup-test-environment.cjs'],
  testMatch: ['<rootDir>/test/contracts/**/*.contract-spec.ts'],
  maxWorkers: 1,
  testTimeout: 120000,
};

export default config;

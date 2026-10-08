import type { Config } from 'jest';
import baseConfig from './jest.shared.cjs';

const config: Config = {
  ...(baseConfig as Config),
  collectCoverage: false,
  setupFiles: ['<rootDir>/test/setup-test-environment.cjs'],
  testMatch: ['<rootDir>/src/**/*.integration.spec.ts'],
  maxWorkers: 1,
};

export default config;

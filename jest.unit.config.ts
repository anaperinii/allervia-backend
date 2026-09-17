import type { Config } from 'jest';
import baseConfig from './jest.shared.cjs';

const config: Config = {
  ...(baseConfig as Config),
  collectCoverage: false,
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.integration\\.spec\\.ts$',
    '\\.e2e-spec\\.ts$',
  ],
};

export default config;

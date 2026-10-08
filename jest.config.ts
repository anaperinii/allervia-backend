import type { Config } from 'jest';
import sharedConfig from './jest.shared.cjs';

export default {
  ...(sharedConfig as Config),
  setupFiles: ['<rootDir>/test/setup-test-environment.cjs'],
} satisfies Config;

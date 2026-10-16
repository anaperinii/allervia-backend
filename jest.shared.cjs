module.exports = {
  preset: 'ts-jest',

  testEnvironment: 'node',

  moduleFileExtensions: ['ts', 'js', 'json', 'node'],

  collectCoverage: false,

  coverageThreshold: {
    global: {
      lines: 80,
      branches: 60,
    },
  },

  rootDir: '.',

  testMatch: ['**/*.spec.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/artifacts/',
    '<rootDir>/tmp/',
  ],

  setupFiles: ['<rootDir>/test/setup-test-environment.cjs'],

  setupFilesAfterEnv: ['<rootDir>/test/support/test-hygiene.cjs'],

  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.integration.spec.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],

  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: { allowJs: true } }],
    '^.+\\.mjs$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },

  transformIgnorePatterns: [
    'node_modules/(?!(@faker-js/faker|@scure|@noble|@otplib|otplib)/)',
  ],

  coverageDirectory: 'coverage',

  coverageReporters: ['text', 'lcov', 'html'],

  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
    '^otplib$': '<rootDir>/node_modules/otplib/dist/index.cjs',
  },

  modulePaths: ['<rootDir>'],

  testTimeout: 30000,

  maxWorkers: 1,
};

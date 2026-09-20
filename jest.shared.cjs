/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',

  testEnvironment: 'node',

  moduleFileExtensions: ['ts', 'js', 'json', 'node'],

  collectCoverage: true,

  rootDir: '.',

  testMatch: ['**/*.spec.ts', '**/*.integration.spec.ts'],

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

  // `@scure/base` (via otplib) é ESM puro: o Node 22 aceita require de ESM, o
  // Jest não. Transformar o pacote é o que mantém a suíte executável.
  transformIgnorePatterns: [
    'node_modules/(?!(@faker-js/faker|@scure|@noble|@otplib|otplib)/)',
  ],

  coverageDirectory: 'coverage',

  coverageReporters: ['text', 'lcov', 'html'],

  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
    // otplib publica ESM e também os fontes TypeScript; o Jest resolveria os
    // fontes e falharia no ESM de `@scure/base`. O bundle CJS é o mesmo código.
    '^otplib$': '<rootDir>/node_modules/otplib/dist/index.cjs',
  },

  modulePaths: ['<rootDir>'],

  testTimeout: 30000,

  maxWorkers: 1, // Importante para testes de integração com banco
};

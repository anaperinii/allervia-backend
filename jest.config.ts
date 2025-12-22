module.exports = {
  
  preset: 'ts-jest',

  testEnvironment: 'node',

  moduleFileExtensions: ['ts', 'js', 'json', 'node'],

  collectCoverage: true,

  rootDir: '.', 

  testMatch: [
    '**/*.spec.ts',
    '**/*.integration.spec.ts'
  ],
  
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.integration.spec.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],

  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  transformIgnorePatterns: [
    'node_modules/(?!(@faker-js/faker)/)'
  ],
  
  coverageDirectory: 'coverage',

  coverageReporters: ['text', 'lcov', 'html'],

  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
  },

  modulePaths: ['<rootDir>'],
  
  testTimeout: 30000,

  maxWorkers: 1, // Importante para testes de integração com banco

};
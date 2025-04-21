/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./tests/setup.ts'],
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testTimeout: 10000,
  // Transform TypeScript files with ts-jest
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Use the tests-specific tsconfig.json
        tsconfig: 'tests/tsconfig.json',
      },
    ],
  },
  // Mock CSS imports
  moduleNameMapper: {
    '\\.css$': '<rootDir>/tests/__mocks__/styleMock.js',
  },
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
  // Report test coverage as text and HTML
  coverageReporters: ['text', 'html'],
};
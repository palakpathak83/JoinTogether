export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    '^.+\\.tsx?$': '<rootDir>/tests/helpers/esbuildTransformer.mjs',
  },
  testMatch: ['<rootDir>/tests/backend/**/*.test.ts'],
  testTimeout: 60000,
};

module.exports = {
  preset: 'jest-expo',
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.ts?(x)',
    '<rootDir>/src/theme/__tests__/**/*.test.ts?(x)',
    '<rootDir>/src/components/__tests__/**/*.test.ts?(x)',
    '<rootDir>/src/components/ui/__tests__/**/*.test.ts?(x)',
    '<rootDir>/app/**/__tests__/**/*.test.ts?(x)',
  ],
};

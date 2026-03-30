module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|@react-native-community|@react-navigation|react-native-reanimated|react-native-gesture-handler|react-native-safe-area-context|nativewind|react-native-css-interop|react-native-worklets|react-native-worklets-core)/)',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    '^@env$': '<rootDir>/__mocks__/envMock.js',
  },
};

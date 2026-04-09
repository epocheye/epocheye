module.exports = {
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
      },
    ],
    ...(process.env.NODE_ENV === 'production'
      ? ['transform-remove-console']
      : []),
    'react-native-reanimated/plugin',
  ],
};

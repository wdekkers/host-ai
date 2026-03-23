import baseConfig from '@walt/config-eslint';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      // Generated API client code uses `any` extensively — suppress for this package
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];

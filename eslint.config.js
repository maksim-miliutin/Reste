const expo = require('eslint-config-expo/flat');
const tseslint = require('typescript-eslint');

module.exports = [
  ...expo,
  ...tseslint.configs.recommended,
  { ignores: ['dist/*', 'node_modules/*', '.expo/*', 'backend/*'] },
  {
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    // Node-скрипты и конфиги — CommonJS, require здесь по назначению
    files: ['scripts/**/*.js', '*.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];

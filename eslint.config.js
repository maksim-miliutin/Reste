const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  { ignores: ['dist/*', 'node_modules/*', '.expo/*'] },
  {
    rules: {
      'no-unused-vars': 'off',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];

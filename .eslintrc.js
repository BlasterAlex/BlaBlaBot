module.exports = {
  'env': {
    'browser': true,
    'commonjs': true,
    'es6': true
  },
  'extends': 'eslint:recommended',
  'globals': {
    'Atomics': 'readonly',
    'SharedArrayBuffer': 'readonly'
  },
  'parserOptions': {
    'ecmaVersion': 2018,
    'sourceType': 'module'
  },
  'rules': {
    'no-useless-escape': 'off',
    'no-undef': 'off',
    'no-extra-semi': 'warn',
    'no-unused-vars': 'warn',
    'no-inner-declarations': 'warn',
    'indent': ['warn', 2, {
      'SwitchCase': 1,
      'outerIIFEBody': 0
    }],
    'linebreak-style': 'off',
    'quotes': ['warn', 'single'],
    'semi': ['warn', 'always']
  }
};
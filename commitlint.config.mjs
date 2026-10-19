/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'api',
        'web',
        'auth',
        'booking',
        'billing',
        'housekeeping',
        'db',
        'infra',
        'ci',
        'deps',
        'docs',
      ],
    ],
  },
};

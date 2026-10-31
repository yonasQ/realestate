import next from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const config = [
  ...next,
  ...nextTs,
  {
    rules: {
      // Underscore-prefixed bindings are intentional (e.g. omitting private fields via destructuring).
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  { ignores: ['.next/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'drizzle/**', 'storage/**', '.test-storage/**'] },
]

export default config

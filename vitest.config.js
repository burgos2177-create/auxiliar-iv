import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    environmentMatchGlobs: [['tests/**/*.dom.test.js', 'jsdom']],
  },
})

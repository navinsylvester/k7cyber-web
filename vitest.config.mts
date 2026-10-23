import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    // `server-only` throws when imported outside React Server Components; the support-portal libraries carry it.
    alias: { 'server-only': new URL('./tests/helpers/server-only.ts', import.meta.url).pathname },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // Five database files each boot Payload and push the schema at once; the boot alone can take longer than the default 10 s.
    hookTimeout: 60_000,
    // A database test that walks a whole flow (onboarding, deals) runs past 5 s when every database file is booting at once.
    testTimeout: 30_000,
    // Ten files boot Payload, each with its own Postgres pool; all at once they pass the server's 100 connections ("sorry, too
    // many clients already") and whole files fail at boot. Four workers keep the pools inside the limit.
    maxWorkers: 4,
  },
})

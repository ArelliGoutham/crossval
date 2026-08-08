import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run dev',
    env: {
      APP_ORIGIN: 'http://localhost:3000',
      BCRYPT_COST: '12',
      MONGODB_DB_NAME: 'crossval_task_7_e2e',
      MONGODB_URI: 'mongodb://localhost:27018/?replicaSet=rs0',
      NODE_ENV: 'test',
      SESSION_TTL_DAYS: '7',
    },
    reuseExistingServer: !process.env.CI,
    url: 'http://localhost:3000',
  },
});

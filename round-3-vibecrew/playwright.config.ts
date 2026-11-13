import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',
  testMatch:'browser.spec.ts',
  use:{browserName:'chromium',headless:true,reducedMotion:'reduce'},
  webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:true},
});

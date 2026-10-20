import { expect, test } from 'bun:test';
import { localDemoModeEnabled } from '../src/lib/local-demo-mode.ts';

test('a missing SQL_HOST never turns on unsaved demo orders or account sync; demo mode is opt-in and never in production', () => {
  expect(localDemoModeEnabled({})).toBe(false);
  expect(localDemoModeEnabled({ NODE_ENV: 'production' })).toBe(false);
  expect(localDemoModeEnabled({ NODE_ENV: 'development' })).toBe(false);
  expect(localDemoModeEnabled({ VARNAM_LOCAL_DEMO_MODE: 'true', NODE_ENV: 'production' })).toBe(false);
  expect(localDemoModeEnabled({ VARNAM_LOCAL_DEMO_MODE: '1', NODE_ENV: 'development' })).toBe(false);
  expect(localDemoModeEnabled({ VARNAM_LOCAL_DEMO_MODE: 'true', NODE_ENV: 'development' })).toBe(true);
});

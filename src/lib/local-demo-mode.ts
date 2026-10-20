/**
 * Local demo mode lets /api/orders and /api/auth/sync answer without
 * PostgreSQL. Nothing is saved in this mode. It must be opted into explicitly
 * and is never active in a production build, so a missing database
 * configuration can never make the live store report "Confirmed" (or a synced
 * account) for data that was not actually saved.
 */
export function localDemoModeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.VARNAM_LOCAL_DEMO_MODE === 'true' && env.NODE_ENV !== 'production';
}

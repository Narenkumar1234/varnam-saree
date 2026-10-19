export const CUSTOMER_AUTH_MESSAGES = {
  CUSTOMER_AUTH_CLIENT_NOT_CONFIGURED: 'Customer Google sign-in is not configured. Please contact the store or continue as a guest.',
  CUSTOMER_AUTH_INITIALIZATION_FAILED: 'The sign-in service could not start. Please retry or contact the store.',
  CUSTOMER_AUTH_SERVICE_RESPONSE: 'The sign-in service returned an unexpected response. Please retry or contact the store.',
  CUSTOMER_AUTH_NOT_CONFIGURED: 'Customer sign-in verification is not configured on the server. Please contact the store or continue as a guest.',
  CUSTOMER_AUTH_PROJECT_MISMATCH: 'The website and server use different Firebase projects. Please contact the store.',
  CUSTOMER_AUTH_INVALID_CREDENTIALS: 'The server Firebase credentials are invalid or lack permission. Please contact the store.',
  CUSTOMER_AUTH_REQUIRED: 'Sign in with Google to access your account.',
  CUSTOMER_AUTH_TOKEN_REJECTED: 'Your sign-in token was rejected or has expired. Please sign in with Google again.',
  CUSTOMER_AUTH_IDENTITY_REQUIRED: 'Sign in with a verified Google account to continue.',
  CUSTOMER_AUTH_VERIFICATION_UNAVAILABLE: 'Google sign-in verification is temporarily unavailable. Please retry or continue as a guest.',
  CUSTOMER_ACCOUNT_UNAVAILABLE: 'Your verified account could not be loaded from the store database. Please retry or continue as a guest.',
  CUSTOMER_ORDERS_UNAVAILABLE: 'Your orders could not be loaded. Please retry.',
  CUSTOMER_AUTH_NETWORK: 'Could not connect to sign-in verification. Check your connection and retry.',
  CUSTOMER_AUTH_UNAUTHORIZED_DOMAIN: 'Google sign-in is not enabled for this website domain. Please contact the store.',
  CUSTOMER_AUTH_PROVIDER_DISABLED: 'Google sign-in is disabled for this Firebase project. Please contact the store.',
  CUSTOMER_AUTH_POPUP_BLOCKED: 'Your browser blocked the Google sign-in window. Allow popups for this site, then choose Continue with Google. In an in-app browser, open this site in your usual browser.',
  CUSTOMER_AUTH_POPUP_CLOSED: 'Google sign-in was cancelled before it completed. Choose Continue with Google to try again.',
  CUSTOMER_AUTH_POPUP_PENDING: 'Another Google sign-in window is already open. Complete that window or close it and retry.',
  CUSTOMER_AUTH_STORAGE_UNAVAILABLE: 'Your browser could not save the Google sign-in session. Allow site storage or try your usual browser.',
  CUSTOMER_AUTH_GOOGLE_FAILED: 'Google sign-in failed before account verification. Please retry or contact the store.',
  CUSTOMER_AUTH_SIGN_OUT_FAILED: 'Sign-out could not be completed. Please retry signing out.',
} as const;

export type CustomerAuthCode = keyof typeof CUSTOMER_AUTH_MESSAGES;
export interface CustomerAuthIssue { code: CustomerAuthCode; message: string }
export const authIssue = (code: CustomerAuthCode): CustomerAuthIssue => ({ code, message: CUSTOMER_AUTH_MESSAGES[code] });

export class CustomerAuthError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: CustomerAuthCode = 'CUSTOMER_AUTH_REQUIRED', public readonly reason?: string) { super(message); }
}

export function isCustomerAuthCode(value: unknown): value is CustomerAuthCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CUSTOMER_AUTH_MESSAGES, value);
}

// Map codes only. SDK error.message/customData can contain a token, API key,
// email or provider response and must not be rendered or logged.
export function mapCustomerAuthError(error: unknown): CustomerAuthIssue {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  if (isCustomerAuthCode(code)) return authIssue(code);
  switch (code) {
    case 'auth/unauthorized-domain': return authIssue('CUSTOMER_AUTH_UNAUTHORIZED_DOMAIN');
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation': return authIssue('CUSTOMER_AUTH_PROVIDER_DISABLED');
    case 'auth/invalid-api-key':
    case 'auth/invalid-app-id':
    case 'auth/invalid-auth-domain':
    case 'auth/app-not-authorized':
    case 'auth/configuration-not-found': return authIssue('CUSTOMER_AUTH_CLIENT_NOT_CONFIGURED');
    case 'auth/popup-blocked': return authIssue('CUSTOMER_AUTH_POPUP_BLOCKED');
    case 'auth/popup-closed-by-user': return authIssue('CUSTOMER_AUTH_POPUP_CLOSED');
    case 'auth/cancelled-popup-request': return authIssue('CUSTOMER_AUTH_POPUP_PENDING');
    case 'auth/network-request-failed': return authIssue('CUSTOMER_AUTH_NETWORK');
    case 'auth/web-storage-unsupported': return authIssue('CUSTOMER_AUTH_STORAGE_UNAVAILABLE');
    case 'auth/user-token-expired':
    case 'auth/invalid-user-token':
    case 'auth/user-disabled': return authIssue('CUSTOMER_AUTH_TOKEN_REJECTED');
    default: return authIssue('CUSTOMER_AUTH_GOOGLE_FAILED');
  }
}

/** Only diagnostic codes; never error.message, stack, tokens or credentials. */
export function safeAuthReason(error: unknown): string {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  if (isCustomerAuthCode(code)) return code;
  if (typeof code === 'string' && [
    'auth/argument-error', 'auth/invalid-argument', 'auth/invalid-id-token',
    'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled',
    'auth/user-not-found', 'auth/invalid-credential', 'app/invalid-credential',
    'auth/insufficient-permission', 'auth/project-not-found', 'auth/internal-error',
    'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET',
    'MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND', 'ERR_REQUIRE_ESM',
    'ERR_PACKAGE_PATH_NOT_EXPORTED', '28P01', '3D000', '42P01', '42501',
  ].includes(code)) return code;
  return 'UNKNOWN_SERVER_ERROR';
}

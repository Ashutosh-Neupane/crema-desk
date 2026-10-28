/**
 * CSRF Protection Service
 *
 * Generates and validates CSRF tokens to protect against cross-site request forgery.
 * Uses a combination of cookie-based double-submit pattern and token validation.
 *
 * Reference: implementation1/14-secret-management-review.md
 */

import crypto from "crypto";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_COOKIE_NAME = "csrf-token";

/**
 * Generate a cryptographically secure CSRF token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Validate a CSRF token against the expected value.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function validateCsrfToken(
  token: string | null | undefined,
  expectedToken: string | null | undefined,
): boolean {
  if (!token || !expectedToken) return false;
  if (token.length !== expectedToken.length) return false;

  // Constant-time comparison to prevent timing attacks
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Get the expected CSRF header name for client requests.
 */
export function getCsrfHeaderName(): string {
  return CSRF_HEADER_NAME;
}

/**
 * Get the CSRF cookie name.
 */
export function getCsrfCookieName(): string {
  return CSRF_COOKIE_NAME;
}

/**
 * CSRF-safe methods that don't require token validation.
 */
const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Check if a request method requires CSRF protection.
 */
export function requiresCsrfProtection(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

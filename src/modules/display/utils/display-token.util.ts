import { randomBytes, createHash } from 'crypto';

/**
 * Unlike the guest sessionToken (stored plain, since possession alone is the
 * credential and it's short-lived), a display token lives on a TV for as long
 * as the device is deployed — so only its sha256 digest is ever persisted.
 */
export function generateDisplayToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashDisplayToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

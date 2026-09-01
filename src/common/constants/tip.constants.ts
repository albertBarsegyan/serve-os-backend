/**
 * Absolute ceiling for a guest-submitted tip, in minor currency units (cents) — a
 * typo/fat-finger + DoS guard, not a business rule. The real cap applied in
 * TableSessionsService is min(this, 200% of the order subtotal).
 */
export const GUEST_TIP_ABSOLUTE_MAX_MINOR_UNITS = 100_000; // $1,000.00

/**
 * How far a guest tip may exceed the order subtotal before being rejected, expressed as a
 * multiplier (2 == 200%). Checked against the order's own line items at write time, never
 * a client-supplied total.
 */
export const GUEST_TIP_SUBTOTAL_MULTIPLIER_CAP = 2;

/**
 * Generous absolute ceiling for a staff-recorded tip, in major currency units — a typo
 * guard only. Staff have legitimate over-cap cases (cash tips on comped bills,
 * split-remainder corrections) so this is intentionally far looser than the guest cap.
 */
export const STAFF_TIP_ABSOLUTE_MAX_MAJOR_UNITS = 10_000; // $10,000.00

/** Staff tips at/above this amount (major units) get logged with the acting staff ID. */
export const STAFF_TIP_LOG_THRESHOLD_MAJOR_UNITS = 50;

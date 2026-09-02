/**
 * Realtime event names — the single source of truth for every Socket.io event name used by
 * KitchenGateway. Kept in sync with serve-os/src/shared/realtime/events.ts (same key names,
 * same string values) — never add a raw string literal for an event name outside these two
 * files, and never let the two drift apart.
 */

// ── Client → Server ───────────────────────────────────────────────────────────

export const CLIENT_EVENTS = {
  JOIN_SESSION: 'join-session',
  JOIN_BUSINESS: 'join-business',
  JOIN_KITCHEN: 'join-kitchen',
  JOIN_DISPLAY: 'join-display',
  JOIN_MENU: 'join-menu',
  LEAVE_SESSION: 'leave-session',
  LEAVE_BUSINESS: 'leave-business',
  LEAVE_KITCHEN: 'leave-kitchen',
  LEAVE_DISPLAY: 'leave-display',
  LEAVE_MENU: 'leave-menu',
  CALL_WAITER: 'call-waiter',
} as const;

// ── Server → Client ───────────────────────────────────────────────────────────

export const SERVER_EVENTS = {
  // Legacy reconnect-sync event (join-session handler only)
  ORDER_STATUS_CHANGED: 'order:status-changed',
  ORDER_PENDING_CONFIRMATION: 'order-pending-confirmation',
  SESSION_CLOSED: 'session-closed',
  // Per-transition order lifecycle events
  ORDER_CREATED: 'order:created',
  ORDER_CONFIRMED: 'order:confirmed',
  ORDER_PREPARING: 'order:preparing',
  ORDER_READY: 'order:ready',
  ORDER_SERVED: 'order:served',
  ORDER_CANCELLED: 'order:cancelled',
  ORDER_CALL_WAITER: 'order:call-waiter',
  ORDER_WAITER_ACKNOWLEDGED: 'order:waiter-acknowledged',
  ORDER_PAYMENT_OPEN: 'order:payment-open',
  ORDER_PAID: 'order:paid',
  ORDER_PAYMENT_FAILED: 'order:payment-failed',
  ORDER_REFUNDED: 'order:refunded',
  ORDER_TIP_UPDATED: 'order:tip-updated',
  // Session lifecycle events — business room (staff) unless noted otherwise
  SESSION_OPENED: 'session:opened',
  SESSION_JOINED: 'session:joined',
  SESSION_SPLIT: 'session:split',
  // Venue TV display feed (sanitized — no PII/payment fields, see DisplayOrderPayload)
  DISPLAY_ORDER_UPDATED: 'display:order-updated',
  DISPLAY_ORDER_REMOVED: 'display:order-removed',
  // Menu feed — lightweight "refetch" signal, not a full product payload
  MENU_AVAILABILITY_CHANGED: 'menu:availability-changed',
} as const;

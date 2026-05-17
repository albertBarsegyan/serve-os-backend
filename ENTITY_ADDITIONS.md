# Entity Additions & Fixes — MVP Gap Resolution

## Why This File Exists

The initial entity set (`ENTITY_REFACTOR.md`) covers the core transaction flow.
This file adds the pieces that are **missing from the ERD but required for MVP** — without them the system either cannot be built end-to-end, or will require breaking schema migrations the moment you scale.

Do **not** modify anything defined in `ENTITY_REFACTOR.md` unless this file explicitly says to.
Apply all changes in order — later sections depend on earlier ones.

---

## Decision: What Is Included and Why

| Addition | Reason included in MVP |
|---|---|
| `CustomerSession` | Without it, anonymous customer cart has no owner — the entire customer flow breaks |
| `BusinessPaymentMethod` | Owner setup step requires saving which methods the business accepts |
| `StaffInvite` | Without it there is no way to onboard a waiter or chef into the system |
| `ModifierGroup` + `Modifier` | Retrofitting modifiers after launch requires migrating every existing `OrderItem` — do it now |
| `OrderItemModifier` | Price snapshot of selected modifiers at order time — required for correct billing |
| Fix: `ORDER` → `PAYMENT` one-to-many | One-to-one breaks on payment failure, retry, and refunds — fix the schema now |
| Fix: `ORDER.customerSessionId` | Links an order back to the anonymous session that placed it |

**Not included** (defer post-MVP): media/file entity, audit log, discount/promotion, analytics tables, notification history.

---

## New Files to Create

| File | Class | Table |
|---|---|---|
| `customer-session.entity.ts` | `CustomerSession` | `customer_sessions` |
| `business-payment-method.entity.ts` | `BusinessPaymentMethod` | `business_payment_methods` |
| `staff-invite.entity.ts` | `StaffInvite` | `staff_invites` |
| `modifier-group.entity.ts` | `ModifierGroup` | `modifier_groups` |
| `modifier.entity.ts` | `Modifier` | `modifiers` |
| `order-item-modifier.entity.ts` | `OrderItemModifier` | `order_item_modifiers` |

---

## Existing Files to Modify

| File | What changes |
|---|---|
| `order.entity.ts` | Add `customerSessionId` FK + relation; fix Payment relation to one-to-many |
| `order-item.entity.ts` | Add `selectedModifiers` OneToMany relation |
| `product.entity.ts` | Add `modifierGroups` ManyToMany relation + join table |
| `business.entity.ts` | Add `paymentMethods` OneToMany relation |
| `staff.entity.ts` | Add `sentInvites` OneToMany relation |

---

## Enums to Add

Add these to your shared `enums.ts` (or to the top of each new entity file):

```typescript
export enum ModifierSelectionType {
  SINGLE   = 'SINGLE',    // radio — customer picks exactly one option
  MULTIPLE = 'MULTIPLE',  // checkbox — customer picks one or more options
}
```

> `PaymentMethod` enum already exists. Do not redefine it.

---

## 1. CustomerSession (`customer_sessions`)

**Purpose**: Tracks an anonymous customer who scanned a QR code.
One session covers the full visit at a table (open → order(s) → pay → close).
The session token is embedded in the QR URL and identifies the customer for cart and order tracking.
Cart contents live in Redis keyed by `session.token`. When the customer places an order, the cart is flushed and an `Order` is created linked to this session.

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';

@Entity('customer_sessions')
export class CustomerSession {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  tableId: string;

  @ManyToOne(() => Table)
  @JoinColumn({ name: 'tableId' })
  table: Table;

  @Column({ unique: true })
  @Index()
  token: string;          // UUID — embedded in QR URL, used as Redis cart key

  @Column({ type: 'timestamp' })
  expiresAt: Date;        // typically +6 to +12 hours from createdAt

  @Column({ default: true })
  isActive: boolean;      // set false after payment completed or staff closes table

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @OneToMany(() => Order, (o) => o.customerSession)
  orders: Order[];
}
```

**Relation rules**:
- `CustomerSession` → `Business`: ManyToOne, `onDelete: 'CASCADE'`
- `CustomerSession` → `Table`: ManyToOne, no cascade
- `CustomerSession` → `Order`: OneToMany inverse (declared in Order)

---

## 2. BusinessPaymentMethod (`business_payment_methods`)

**Purpose**: Stores which payment methods an individual business has enabled during setup.
Without this, the owner admin panel has nowhere to persist these settings, and the customer
web app cannot know which payment options to show at checkout.

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';

@Entity('business_payment_methods')
@Unique(['businessId', 'method'])   // one record per method per business
export class BusinessPaymentMethod {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business, (b) => b.paymentMethods, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;  // CASH | POS | ONLINE — reuses existing enum

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config: {
    posTerminalId?: string;       // POS: terminal reference
    onlineGateway?: string;       // ONLINE: 'stripe' | 'idram' | etc.
    onlinePublicKey?: string;     // ONLINE: publishable key (never secret key here)
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Add to `Business` entity**:
```typescript
@OneToMany(() => BusinessPaymentMethod, (pm) => pm.business)
paymentMethods: BusinessPaymentMethod[];
```

---

## 3. StaffInvite (`staff_invites`)

**Purpose**: The only mechanism for an owner or admin to add a waiter or chef to their business.
An invite is created with an email + role, a unique token is emailed to the recipient,
and when they click the link they create a `User` account and a `Staff` record is auto-created.
Without this table there is no onboarding flow at all.

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';

@Entity('staff_invites')
export class StaffInvite {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  invitedBy: string;   // Staff.id of the person who sent the invite

  @ManyToOne(() => Staff, (s) => s.sentInvites)
  @JoinColumn({ name: 'invitedBy' })
  inviter: Staff;

  @Column()
  email: string;       // the email address the invite was sent to

  @Column({ type: 'enum', enum: StaffRole })
  role: StaffRole;     // WAITER | CHEF | ADMIN

  @Column({ unique: true })
  @Index()
  token: string;       // UUID — included in the invite link

  @Column({ type: 'timestamp' })
  expiresAt: Date;     // 48 hours from createdAt is a sensible default

  @Column({ default: false })
  isAccepted: boolean; // set true when the invitee registers

  @CreateDateColumn()
  createdAt: Date;
}
```

**Add to `Staff` entity**:
```typescript
@OneToMany(() => StaffInvite, (i) => i.inviter)
sentInvites: StaffInvite[];
```

---

## 4. ModifierGroup (`modifier_groups`)

**Purpose**: A named group of options that can be attached to products.
Examples: "Size" (Single, required), "Extras" (Multiple, optional), "Cooking preference" (Single, required).
One group can be reused across multiple products via the join table on `Product`.

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, ManyToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('modifier_groups')
export class ModifierGroup {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  name: string;              // 'Size', 'Extras', 'Cooking preference'

  @Column({
    type: 'enum',
    enum: ModifierSelectionType,
    default: ModifierSelectionType.SINGLE,
  })
  selectionType: ModifierSelectionType;

  @Column({ default: false })
  isRequired: boolean;       // whether customer must pick at least one option

  @Column({ default: 1 })
  minSelections: number;     // minimum number of options customer must pick

  @Column({ nullable: true })
  maxSelections: number;     // null = no limit; typically 1 for SINGLE

  @Column({ default: 0 })
  position: number;          // display order on product page

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Modifier, (m) => m.group, { cascade: ['insert', 'update'] })
  modifiers: Modifier[];

  @ManyToMany(() => Product, (p) => p.modifierGroups)
  products: Product[];
}
```

---

## 5. Modifier (`modifiers`)

**Purpose**: A single selectable option within a `ModifierGroup`.
`priceAdjustment` can be 0 (free extra), positive (paid addon), or negative (discount option).
The price and name are snapshotted into `OrderItemModifier` at order time — do not change these after launch without a migration plan.

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('modifiers')
export class Modifier {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  groupId: string;

  @ManyToOne(() => ModifierGroup, (g) => g.modifiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: ModifierGroup;

  @Column()
  name: string;              // 'Large', 'Extra cheese', 'Well done', 'No onions'

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceAdjustment: number;   // added on top of product base price

  @Column({ default: 0 })
  position: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => OrderItemModifier, (oim) => oim.modifier)
  orderItemModifiers: OrderItemModifier[];
}
```

---

## 6. OrderItemModifier (`order_item_modifiers`)

**Purpose**: Snapshots which modifiers a customer selected for a specific `OrderItem`.
Stores name and price at the time of the order — this is **critical**.
Never reference `Modifier.name` or `Modifier.priceAdjustment` for billing;
always read from this snapshot table, the same way `OrderItem.unitPrice` snapshots `Product.price`.

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';

@Entity('order_item_modifiers')
export class OrderItemModifier {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderItemId: string;

  @ManyToOne(() => OrderItem, (oi) => oi.selectedModifiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderItemId' })
  orderItem: OrderItem;

  @Column()
  modifierId: string;        // kept for reference, but do not use for billing

  @ManyToOne(() => Modifier, (m) => m.orderItemModifiers)
  @JoinColumn({ name: 'modifierId' })
  modifier: Modifier;

  // ── Price snapshots (source of truth for billing) ──
  @Column()
  modifierName: string;      // snapshot of Modifier.name at order time

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  priceAdjustment: number;   // snapshot of Modifier.priceAdjustment at order time

  @CreateDateColumn()
  createdAt: Date;
}
```

---

## Existing Entity Modifications

### `order.entity.ts` — two changes

**Change 1: Add `customerSessionId` FK** (nullable — staff can also place orders directly)

```typescript
@Column({ nullable: true })
customerSessionId: string;

@ManyToOne(() => CustomerSession, (s) => s.orders, { nullable: true })
@JoinColumn({ name: 'customerSessionId' })
customerSession: CustomerSession;
```

**Change 2: Fix Payment relation from one-to-one to one-to-many**

Remove this (if it exists as `@OneToOne`):
```typescript
// DELETE — do not use OneToOne for payments
@OneToOne(() => Payment, (p) => p.order)
payment: Payment;
```

Replace with (or confirm it already reads as):
```typescript
// CORRECT — one order can have multiple payment attempts
@OneToMany(() => Payment, (p) => p.order)
payments: Payment[];
```

> The service layer enforces that only one `COMPLETED` payment exists per order.
> The schema must not enforce this — payment failures and retries require multiple records.

---

### `order-item.entity.ts` — add `selectedModifiers` relation

```typescript
@OneToMany(() => OrderItemModifier, (oim) => oim.orderItem, { cascade: ['insert', 'update'] })
selectedModifiers: OrderItemModifier[];
```

---

### `product.entity.ts` — add `modifierGroups` ManyToMany

```typescript
import { ManyToMany, JoinTable } from 'typeorm';

@ManyToMany(() => ModifierGroup, (g) => g.products)
@JoinTable({
  name: 'product_modifier_groups',          // explicit join table name
  joinColumn:        { name: 'productId',       referencedColumnName: 'id' },
  inverseJoinColumn: { name: 'modifierGroupId', referencedColumnName: 'id' },
})
modifierGroups: ModifierGroup[];
```

---

### `business.entity.ts` — add `paymentMethods` relation

```typescript
@OneToMany(() => BusinessPaymentMethod, (pm) => pm.business)
paymentMethods: BusinessPaymentMethod[];
```

---

### `staff.entity.ts` — add `sentInvites` relation

```typescript
@OneToMany(() => StaffInvite, (i) => i.inviter)
sentInvites: StaffInvite[];
```

---

## Complete Relation Map (additions only)

```
BUSINESS ──< BUSINESS_PAYMENT_METHOD   Business.id → BusinessPaymentMethod.businessId
BUSINESS ──< CUSTOMER_SESSION          Business.id → CustomerSession.businessId
BUSINESS ──< MODIFIER_GROUP            Business.id → ModifierGroup.businessId
BUSINESS ──< STAFF_INVITE              Business.id → StaffInvite.businessId

TABLE ──< CUSTOMER_SESSION             Table.id → CustomerSession.tableId
STAFF ──< STAFF_INVITE                 Staff.id → StaffInvite.invitedBy

CUSTOMER_SESSION ──< ORDER             CustomerSession.id → Order.customerSessionId  (nullable)

MODIFIER_GROUP ──< MODIFIER            ModifierGroup.id → Modifier.groupId
MODIFIER_GROUP >--< PRODUCT            join table: product_modifier_groups
MODIFIER ──< ORDER_ITEM_MODIFIER       Modifier.id → OrderItemModifier.modifierId
ORDER_ITEM ──< ORDER_ITEM_MODIFIER     OrderItem.id → OrderItemModifier.orderItemId

ORDER ──o{ PAYMENT                     (changed from one-to-one to one-to-many)
```

---

## Billing Rules (service layer — do not put in entity, document here)

These rules must be enforced in service code, not in the schema:

1. `OrderItem.unitPrice` = `Product.price` at creation time. Never read `product.price` later.
2. `OrderItemModifier.priceAdjustment` = `Modifier.priceAdjustment` at creation time.
3. `Order.totalAmount` = `SUM(item.quantity × (item.unitPrice + SUM(modifier.priceAdjustment)))` for all items.
4. Only one `Payment` with `status = COMPLETED` is allowed per `Order`. Enforce in service, not schema.
5. A `CustomerSession` must be `isActive = true` for a customer to place an order.
6. A `StaffInvite.token` must not be expired and `isAccepted = false` before registering a new staff member.

---

## Global Rules (carry over from ENTITY_REFACTOR.md)

- Every FK column has both a raw `@Column()` and a TypeORM relation with `@JoinColumn({ name: '...' })`.
- Nullable FKs: both `@Column({ nullable: true })` and `{ nullable: true }` on the relation option.
- `cascade: ['insert', 'update']` only on `ModifierGroup → Modifier` and `OrderItem → OrderItemModifier`.
- All decimal columns: `{ type: 'decimal', precision: 10, scale: 2 }`.
- All enum columns: `{ type: 'enum', enum: EnumName }`.
- No `eager: true` anywhere.
- Table names: snake_case plural.

---

## What NOT to Change

- Existing enums: `BusinessType`, `StaffRole`, `TableStatus`, `OrderStatus`, `OrderItemStatus`, `PaymentMethod`, `PaymentStatus`
- JSONB interfaces: `WorkingHours`, `DayHours`, `TaxConfig`, `BusinessSettings`
- Any column or relation already defined in `ENTITY_REFACTOR.md` that is not listed under "Existing Entity Modifications" above
- Any service, controller, DTO, or migration file

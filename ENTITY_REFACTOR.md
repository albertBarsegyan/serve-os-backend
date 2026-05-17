# Entity Refactor Instructions — Restaurant Management System

## Context

This is a NestJS + TypeORM + PostgreSQL hospitality management app.
The goal is to refactor all existing entity files so their relations exactly match the schema defined below.
Do not change business logic, enums, or JSONB interfaces. Only fix entity structure, decorators, FK columns, and relation definitions.

---

## Stack

- **Framework**: NestJS
- **ORM**: TypeORM
- **Database**: PostgreSQL
- **Language**: TypeScript
- **ID strategy**: `uuid` via `@PrimaryGeneratedColumn('uuid')` on every entity
- **Timestamps**: `@CreateDateColumn()` and `@UpdateDateColumn()` on every entity

---

## Entities Overview

There are **10 entities**. Each must live in its own file:

| File | Class | Table name |
|---|---|---|
| `user.entity.ts` | `User` | `users` |
| `business.entity.ts` | `Business` | `businesses` |
| `staff.entity.ts` | `Staff` | `staff` |
| `table.entity.ts` | `Table` | `tables` |
| `kitchen-station.entity.ts` | `KitchenStation` | `kitchen_stations` |
| `menu-category.entity.ts` | `MenuCategory` | `menu_categories` |
| `product.entity.ts` | `Product` | `products` |
| `order.entity.ts` | `Order` | `orders` |
| `order-item.entity.ts` | `OrderItem` | `order_items` |
| `payment.entity.ts` | `Payment` | `payments` |

---

## Relation Map (source of truth)

Every relation listed here must be implemented with both sides declared.
`owning side` = the entity that holds the FK column in the database.

```
USER ──< BUSINESS          User.id → Business.ownerId           (one user owns many businesses)
USER ──< STAFF             User.id → Staff.userId               (one user has many staff records)
BUSINESS ──< STAFF         Business.id → Staff.businessId       (one business has many staff)
BUSINESS ──< TABLE         Business.id → Table.businessId       (one business has many tables)
BUSINESS ──< KITCHEN_STATION  Business.id → KitchenStation.businessId
BUSINESS ──< MENU_CATEGORY    Business.id → MenuCategory.businessId
BUSINESS ──< PRODUCT          Business.id → Product.businessId
BUSINESS ──< ORDER            Business.id → Order.businessId
BUSINESS ──< PAYMENT          Business.id → Payment.businessId
KITCHEN_STATION ──< MENU_CATEGORY  KitchenStation.id → MenuCategory.kitchenStationId  (nullable)
MENU_CATEGORY ──< PRODUCT          MenuCategory.id → Product.categoryId
TABLE ──< ORDER            Table.id → Order.tableId
STAFF ──< ORDER            Staff.id → Order.waiterId             (nullable)
STAFF ──< PAYMENT          Staff.id → Payment.confirmedBy        (nullable)
ORDER ──< ORDER_ITEM       Order.id → OrderItem.orderId          (cascade insert+update)
ORDER ──< PAYMENT          Order.id → Payment.orderId
PRODUCT ──< ORDER_ITEM     Product.id → OrderItem.productId
KITCHEN_STATION ──< ORDER_ITEM  KitchenStation.id → OrderItem.kitchenStationId  (nullable)
```

---

## Per-Entity Refactor Instructions

### 1. `User` (`users`)

**Columns**: `id`, `email` (unique), `passwordHash`, `firstName`, `lastName`, `createdAt`, `updatedAt`

**Relations to declare** (inverse sides, no FK column here):
```typescript
@OneToMany(() => Business, (b) => b.owner)
ownedBusinesses: Business[];

@OneToMany(() => Staff, (s) => s.user)
staffRecords: Staff[];
```

---

### 2. `Business` (`businesses`)

**FK columns this entity owns**:
- `ownerId: string` → references `users.id`

**Decorators on FK**:
```typescript
@Column()
ownerId: string;

@ManyToOne(() => User, (u) => u.ownedBusinesses)
@JoinColumn({ name: 'ownerId' })
owner: User;
```

**Add `@Index()` on `slug` and `@Column({ unique: true })` on `slug`.**

**Inverse OneToMany relations to declare** (no FK column, just the inverse pointer):
```typescript
@OneToMany(() => Staff,          (s) => s.business)    staff: Staff[];
@OneToMany(() => Table,          (t) => t.business)    tables: Table[];
@OneToMany(() => KitchenStation, (k) => k.business)    kitchenStations: KitchenStation[];
@OneToMany(() => MenuCategory,   (c) => c.business)    menuCategories: MenuCategory[];
@OneToMany(() => Product,        (p) => p.business)    products: Product[];
@OneToMany(() => Order,          (o) => o.business)    orders: Order[];
@OneToMany(() => Payment,        (p) => p.business)    payments: Payment[];
```

---

### 3. `Staff` (`staff`)

**Composite unique constraint** — add at class level:
```typescript
@Unique(['userId', 'businessId'])
```

**FK columns this entity owns**:
- `userId: string` → references `users.id`
- `businessId: string` → references `businesses.id`

```typescript
@Column() userId: string;
@ManyToOne(() => User, (u) => u.staffRecords)
@JoinColumn({ name: 'userId' })
user: User;

@Column() businessId: string;
@ManyToOne(() => Business, (b) => b.staff)
@JoinColumn({ name: 'businessId' })
business: Business;
```

**Inverse OneToMany** (no FK here):
```typescript
@OneToMany(() => Order,   (o) => o.waiter)           servedOrders: Order[];
@OneToMany(() => Payment, (p) => p.confirmedByStaff) confirmedPayments: Payment[];
```

---

### 4. `Table` (`tables`)

**FK columns this entity owns**:
- `businessId: string` → references `businesses.id`

```typescript
@Column() businessId: string;
@ManyToOne(() => Business, (b) => b.tables)
@JoinColumn({ name: 'businessId' })
business: Business;
```

**`qrCode` must be `@Column({ unique: true })`** — used as the QR URL token.

**Inverse OneToMany**:
```typescript
@OneToMany(() => Order, (o) => o.table)
orders: Order[];
```

---

### 5. `KitchenStation` (`kitchen_stations`)

**FK columns this entity owns**:
- `businessId: string` → references `businesses.id`

```typescript
@Column() businessId: string;
@ManyToOne(() => Business, (b) => b.kitchenStations)
@JoinColumn({ name: 'businessId' })
business: Business;
```

**Inverse OneToMany**:
```typescript
@OneToMany(() => MenuCategory, (c) => c.kitchenStation) menuCategories: MenuCategory[];
@OneToMany(() => OrderItem,    (i) => i.kitchenStation)  orderItems: OrderItem[];
```

---

### 6. `MenuCategory` (`menu_categories`)

**FK columns this entity owns**:
- `businessId: string` → references `businesses.id`
- `kitchenStationId: string | null` → references `kitchen_stations.id` (**nullable**)

```typescript
@Column() businessId: string;
@ManyToOne(() => Business, (b) => b.menuCategories)
@JoinColumn({ name: 'businessId' })
business: Business;

@Column({ nullable: true }) kitchenStationId: string;
@ManyToOne(() => KitchenStation, (k) => k.menuCategories, { nullable: true })
@JoinColumn({ name: 'kitchenStationId' })
kitchenStation: KitchenStation;
```

**Inverse OneToMany**:
```typescript
@OneToMany(() => Product, (p) => p.category)
products: Product[];
```

---

### 7. `Product` (`products`)

**FK columns this entity owns**:
- `businessId: string` → references `businesses.id`
- `categoryId: string` → references `menu_categories.id`

```typescript
@Column() businessId: string;
@ManyToOne(() => Business, (b) => b.products)
@JoinColumn({ name: 'businessId' })
business: Business;

@Column() categoryId: string;
@ManyToOne(() => MenuCategory, (c) => c.products)
@JoinColumn({ name: 'categoryId' })
category: MenuCategory;
```

**`price` must be `@Column({ type: 'decimal', precision: 10, scale: 2 })`**.

**`allergens` must be `@Column({ type: 'simple-array', nullable: true })`**.

**Inverse OneToMany**:
```typescript
@OneToMany(() => OrderItem, (i) => i.product)
orderItems: OrderItem[];
```

---

### 8. `Order` (`orders`)

**FK columns this entity owns**:
- `businessId: string` → references `businesses.id`
- `tableId: string` → references `tables.id`
- `waiterId: string | null` → references `staff.id` (**nullable** — assigned on confirmation)

```typescript
@Column() businessId: string;
@ManyToOne(() => Business, (b) => b.orders)
@JoinColumn({ name: 'businessId' })
business: Business;

@Column() tableId: string;
@ManyToOne(() => Table, (t) => t.orders)
@JoinColumn({ name: 'tableId' })
table: Table;

@Column({ nullable: true }) waiterId: string;
@ManyToOne(() => Staff, (s) => s.servedOrders, { nullable: true })
@JoinColumn({ name: 'waiterId' })
waiter: Staff;
```

**`totalAmount` must be `@Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })`**.

**Inverse OneToMany**:
```typescript
@OneToMany(() => OrderItem, (i) => i.order, { cascade: ['insert', 'update'] })
items: OrderItem[];

@OneToMany(() => Payment, (p) => p.order)
payments: Payment[];
```

---

### 9. `OrderItem` (`order_items`)

**FK columns this entity owns**:
- `orderId: string` → references `orders.id`
- `productId: string` → references `products.id`
- `kitchenStationId: string | null` → references `kitchen_stations.id` (**nullable** — snapshotted at order creation from product → category → station)

```typescript
@Column() orderId: string;
@ManyToOne(() => Order, (o) => o.items)
@JoinColumn({ name: 'orderId' })
order: Order;

@Column() productId: string;
@ManyToOne(() => Product, (p) => p.orderItems)
@JoinColumn({ name: 'productId' })
product: Product;

@Column({ nullable: true }) kitchenStationId: string;
@ManyToOne(() => KitchenStation, (k) => k.orderItems, { nullable: true })
@JoinColumn({ name: 'kitchenStationId' })
kitchenStation: KitchenStation;
```

**`unitPrice` must be `@Column({ type: 'decimal', precision: 10, scale: 2 })`**.
> This is the price snapshotted at order creation time. Never read `product.price` for billing.

**No inverse OneToMany needed on this entity.**

---

### 10. `Payment` (`payments`)

**FK columns this entity owns**:
- `orderId: string` → references `orders.id`
- `businessId: string` → references `businesses.id`
- `confirmedBy: string | null` → references `staff.id` (**nullable** — only for CASH and POS; ONLINE is auto-confirmed)

```typescript
@Column() orderId: string;
@ManyToOne(() => Order, (o) => o.payments)
@JoinColumn({ name: 'orderId' })
order: Order;

@Column() businessId: string;
@ManyToOne(() => Business, (b) => b.payments)
@JoinColumn({ name: 'businessId' })
business: Business;

@Column({ nullable: true }) confirmedBy: string;
@ManyToOne(() => Staff, (s) => s.confirmedPayments, { nullable: true })
@JoinColumn({ name: 'confirmedBy' })
confirmedByStaff: Staff;
```

**`amount` and `tip` must be `@Column({ type: 'decimal', precision: 10, scale: 2 })`**.

**`confirmedAt` must be `@Column({ type: 'timestamp', nullable: true })`**.

**No inverse OneToMany needed on this entity.**

---

## Global Rules (apply to every entity)

1. **Every FK column must have both** a raw `@Column()` property (e.g. `businessId: string`) and a TypeORM relation property (e.g. `business: Business`) with `@JoinColumn({ name: 'businessId' })` on the owning side.

2. **Inverse sides** (`@OneToMany`) must reference the exact property name on the owning entity. Example: `@OneToMany(() => Order, (o) => o.waiter)` — `o.waiter` must match the property name in `Order`.

3. **Nullable FKs** — when a FK is nullable, both the `@Column({ nullable: true })` and the relation option `{ nullable: true }` must be set.

4. **Cascade** — only `Order → OrderItem` uses cascade: `{ cascade: ['insert', 'update'] }`. No other relation uses cascade.

5. **No `eager: true`** anywhere. All relations are lazy-loaded by query builder or explicit `.find({ relations: [...] })`.

6. **Decimal columns** — always use `{ type: 'decimal', precision: 10, scale: 2 }`. Never use `float` or `double`.

7. **Enum columns** — always use `{ type: 'enum', enum: EnumName }`. The enum must be exported from its own file or from a shared `enums.ts`.

8. **`@Index()`** — add a standalone `@Index()` on `Business.slug` in addition to `unique: true`.

9. **`@Unique(['userId', 'businessId'])`** — class-level decorator on `Staff` only.

10. **Table names** — use snake_case plural. Exactly as listed in the entities overview table above.

---

## What NOT to change

- Enum values and enum names
- JSONB interface definitions (`WorkingHours`, `DayHours`, `TaxConfig`, `BusinessSettings`)
- Column names that already match (do not rename existing columns)
- Any service, controller, DTO, or migration file
- `createdAt` / `updatedAt` decorator pattern

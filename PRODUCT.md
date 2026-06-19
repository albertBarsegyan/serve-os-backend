# Serve-OS — Restaurant & Hospitality Management Platform

Serve-OS is an all-in-one operations platform for hospitality businesses. It replaces paper menus, handwritten tickets, and disconnected POS systems with a single, real-time workflow that connects customers, front-of-house staff, and the kitchen.

---

## Who It's For

Serve-OS is built for any food and beverage venue that takes orders:

- Restaurants
- Cafes
- Bars
- Fast food outlets
- Food trucks
- Hotels (in-room or restaurant dining)
- Event venues

Each venue type gets a tailored feature set out of the box — a bar doesn't need delivery options, and a food truck doesn't need table reservations. Everything is configurable per business.

---

## The Problems It Solves

**Orders get lost or mistranslated.** When a waiter shouts an order to the kitchen or scribbles it on a notepad, errors happen. Serve-OS turns every order into a structured, tracked record the moment it's placed — whether by a customer scanning a QR code or a staff member at the table.

**Customers wait too long to order.** With QR ordering, guests don't have to flag down a waiter to get a menu or place an order. They scan the code on their table and order directly from their phone — no app download required.

**The kitchen doesn't know what's happening on the floor.** A Kitchen Display System (KDS) shows the kitchen every active order in real time, updated instantly as orders come in or change status. No more paper tickets piling up.

**Staff have no clear source of truth.** Everyone — waiters, cashiers, managers — sees the same live order state. When an order moves from the kitchen to ready, every screen reflects it immediately.

**Splitting the bill is a nightmare.** Serve-OS tracks which items each person at a table ordered during their session, so splitting the bill is automatic rather than a guessing game at checkout.

**Managing multiple locations is fragmented.** One owner account can manage multiple businesses from a single login, each with its own staff, menu, and settings.

---

## Key Features

### QR Table Ordering
Every table has a unique QR code. Customers scan it, browse the digital menu, and place orders directly — with no app and no account required. Orders go straight to the kitchen and the front-of-house dashboard the moment they're submitted.

### Digital Menu Builder
Build and manage the full menu online: categories, products, photos, pricing, and product variants. Attach modifier groups (extras, swaps, customizations) to any item. Mark items as unavailable in real time — kitchen staff can toggle availability themselves without needing manager access.

Allergen labels are supported for venues that need them (restaurants, hotels).

### Order Lifecycle Tracking
Every order moves through a clear state machine:

**Placed → Confirmed → In Kitchen → Ready → Delivered → Closed**

Each transition is visible to the right people at the right time. Staff can advance orders, the kitchen marks when food is ready, and waiters see when to pick up and serve.

### Kitchen Display System (KDS)
A dedicated real-time screen for kitchen staff showing every active order, updated the instant a change happens anywhere in the system. No polling, no refreshing — it's live via WebSocket.

### Staff Management & Roles
Invite staff and assign them one of four roles, each with the right level of access:

| Role | What they can do |
|------|-----------------|
| **Manager** | Everything — full access |
| **Waiter** | Create and view orders, manage tables, take payment |
| **Cashier** | Process payments, refunds, view reports |
| **Kitchen** | View orders, mark items ready, toggle menu availability |

Permissions are granular, so businesses can fine-tune access beyond the role defaults.

### Table Management
Create a floor map with all tables, set their capacity, upload photos, and manage their status. Staff can mark tables as reserved or inactive. Each table gets a scannable QR code that ties back to a dining session.

### Payments
Serve-OS supports cash and POS terminal payments. Tips can be added at checkout. Payments are confirmed by staff and tracked per order with a full audit trail.

### Split Bill
When a table session ends, the bill can be split by who ordered what — tracked automatically throughout the session — rather than being divided equally or manually calculated.

### Happy Hour (Bars)
Time-limited pricing rules for bars and venues that run promotions. No manual price changes needed.

### Multi-Business Support
One owner account handles multiple locations. Switching between businesses is instant, and each business has its own isolated data, staff, and settings.

---

## How It All Fits Together

A typical dine-in flow looks like this:

1. A customer sits down and scans the QR code on their table.
2. They browse the live menu and place an order — customizing items with modifiers.
3. The order appears instantly on the kitchen display and the front-of-house dashboard.
4. The kitchen marks the order as ready. The waiter gets notified.
5. Food is served; the order is marked delivered.
6. At the end of the meal, the customer (or staff) views the bill, optionally splits it, and pays — cash, card terminal, or other configured method.
7. The session closes and the table is freed up for the next guests.

The same platform handles the kitchen side of a fast-food counter, a bar tab, or hotel room service — each with only the features that venue actually needs.

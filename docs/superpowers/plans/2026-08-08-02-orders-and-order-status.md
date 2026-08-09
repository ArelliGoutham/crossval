# Orders and Order Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Module 02 (Orders) and Module 03 (Order Status) — a pure settlement-status evaluator and full CRUD for merchant-owned orders with server-computed totals, soft deletes, and payment-locked editability.

**Architecture:** Modular monolith following the identity module pattern. Module 03 is a pure domain function with no infrastructure. Module 02 mirrors identity: domain (types, ports, schemas, errors), application (OrderService), infrastructure (Mongo adapters), and a public.ts contract surface. Orders consumes the Order Status evaluator to include derived status in responses.

**Tech Stack:** Next.js 16, TypeScript (strict), Zod 4, MongoDB 7, Vitest 4

**Specs:** `docs/superpowers/specs/2026-08-08-03-order-status-design.md`, `docs/superpowers/specs/2026-08-08-02-orders-design.md`

---

## File Structure

### Module 03 — Order Status (pure, no infrastructure)

| File                                               | Responsibility                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/modules/order-status/domain/schemas.ts`       | Zod schema for `SettlementInput`, exported `SettlementStatus` literal union             |
| `src/modules/order-status/domain/schemas.test.ts`  | Unit tests for status precedence and invalid input rejection                            |
| `src/modules/order-status/domain/evaluate.ts`      | Pure `evaluateSettlement(input)` function                                               |
| `src/modules/order-status/domain/evaluate.test.ts` | Unit tests for all 7 acceptance criteria                                                |
| `src/modules/order-status/public.ts`               | Exports `evaluateSettlement`, `SettlementInput`, `SettlementResult`, `SettlementStatus` |

### Module 02 — Orders (domain, application, infrastructure, public contract)

| File                                                               | Responsibility                                                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `src/modules/orders/domain/types.ts`                               | `StoredOrder`, `NewStoredOrder`, `StoredLineItem`, `LineItemInput`, `OrderResult`, `OrderSummary`, use-case interfaces |
| `src/modules/orders/domain/errors.ts`                              | `OrderError` class with `OrderErrorCode`                                                                               |
| `src/modules/orders/domain/schemas.ts`                             | Zod schemas for create/update input, line item input, order query filters                                              |
| `src/modules/orders/domain/schemas.test.ts`                        | Unit tests for schema validation                                                                                       |
| `src/modules/orders/domain/ports.ts`                               | `OrderRepository`, `OrderSettlementPort`, `Clock`, `IdGenerator`, `AuditLog` ports + `OrderAuditEvent`                 |
| `src/modules/orders/domain/totals.ts`                              | Pure `computeLineTotal` and `computeSubtotal` functions                                                                |
| `src/modules/orders/domain/totals.test.ts`                         | Unit tests for money computation                                                                                       |
| `src/modules/orders/application/order-service.ts`                  | `OrderService` implementing 5 use cases + `OrderSettlementPort`                                                        |
| `src/modules/orders/application/order-service.test.ts`             | Unit tests for service logic with in-memory test doubles                                                               |
| `src/modules/orders/application/test-doubles.ts`                   | In-memory repository, audit log, clock, id generator, token hasher stubs                                               |
| `src/modules/orders/infrastructure/mongo-order-repository.ts`      | MongoDB `OrderRepository` implementation                                                                               |
| `src/modules/orders/infrastructure/mongo-order-settlement-port.ts` | MongoDB `OrderSettlementPort` implementation (conditional reserve)                                                     |
| `src/modules/orders/infrastructure/mongo-order-audit-log.ts`       | MongoDB audit log for order events                                                                                     |
| `src/modules/orders/infrastructure/ensure-indexes.ts`              | Create MongoDB indexes for orders collection                                                                           |
| `src/modules/orders/infrastructure/create-orders-module.ts`        | Factory that wires infrastructure adapters                                                                             |
| `src/modules/orders/public.ts`                                     | Public contract: use-case interfaces, input/output types, errors, `composeOrdersService` factory                       |

### Composition & HTTP

| File                                              | Responsibility                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/app/composition/orders-api-errors.ts`        | Maps `OrderError` codes to HTTP responses                                |
| `src/app/api/v1/orders/route.ts`                  | `GET` (list) + `POST` (create)                                           |
| `src/app/api/v1/orders/[id]/route.ts`             | `GET` (detail) + `PATCH` (update) + `DELETE` (soft delete)               |
| `tests/api/orders.test.ts`                        | API contract tests for all 5 endpoints                                   |
| `tests/integration/orders/infrastructure.test.ts` | Integration tests for Mongo order repository + settlement port + indexes |

---

## Task 1: Order Status — Zod schema and types

**Files:**

- Create: `src/modules/order-status/domain/schemas.ts`
- Create: `src/modules/order-status/domain/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/order-status/domain/schemas.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';

import {
  settlementInputSchema,
  type SettlementStatus,
} from '@/modules/order-status/domain/schemas';

describe('settlementInputSchema', () => {
  test('accepts valid input with positive total and zero paid', () => {
    const result = settlementInputSchema.parse({
      totalMinor: 100000,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result).toEqual({
      totalMinor: 100000,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });
  });

  test('rejects a zero total', () => {
    const result = settlementInputSchema.safeParse({
      totalMinor: 0,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result.success).toBe(false);
  });

  test('rejects a negative total', () => {
    const result = settlementInputSchema.safeParse({
      totalMinor: -100,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result.success).toBe(false);
  });

  test('rejects negative amount paid', () => {
    const result = settlementInputSchema.safeParse({
      totalMinor: 100000,
      amountPaidMinor: -1,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result.success).toBe(false);
  });

  test('rejects amount paid greater than total', () => {
    const result = settlementInputSchema.safeParse({
      totalMinor: 100000,
      amountPaidMinor: 100001,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result.success).toBe(false);
  });

  test('rejects an invalid date format', () => {
    const result = settlementInputSchema.safeParse({
      totalMinor: 100000,
      amountPaidMinor: 0,
      dueDate: 'not-a-date',
      asOfUtcDate: '2026-08-08',
    });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/order-status/domain/schemas.test.ts`
Expected: FAIL — module `@/modules/order-status/domain/schemas` not found

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/order-status/domain/schemas.ts`:

```typescript
import { z } from 'zod';

export const settlementStatusSchema = z.enum([
  'pending',
  'partially_paid',
  'paid',
  'overdue',
]);

export type SettlementStatus = z.infer<typeof settlementStatusSchema>;

const positiveIntMinorSchema = z
  .number()
  .int()
  .positive('Value must be a positive integer.');

const amountPaidSchema = z
  .number()
  .int()
  .min(0, 'Amount paid must be a non-negative integer.');

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.')
  .refine((value) => {
    const parsed = new Date(value + 'T00:00:00.000Z');
    return !Number.isNaN(parsed.getTime());
  }, 'Date must be a valid calendar date.');

export const settlementInputSchema = z
  .object({
    totalMinor: positiveIntMinorSchema,
    amountPaidMinor: amountPaidSchema,
    dueDate: dateOnlySchema,
    asOfUtcDate: dateOnlySchema,
  })
  .refine((input) => input.amountPaidMinor <= input.totalMinor, {
    message: 'Amount paid cannot exceed the order total.',
    path: ['amountPaidMinor'],
  });

export type SettlementInput = z.infer<typeof settlementInputSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/order-status/domain/schemas.test.ts`
Expected: PASS — all 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/order-status/domain/schemas.ts src/modules/order-status/domain/schemas.test.ts
git commit -m "feat: define order status settlement schemas"
```

---

## Task 2: Order Status — evaluateSettlement pure function

**Files:**

- Create: `src/modules/order-status/domain/evaluate.ts`
- Create: `src/modules/order-status/domain/evaluate.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/order-status/domain/evaluate.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';

import { evaluateSettlement } from '@/modules/order-status/domain/evaluate';

describe('evaluateSettlement', () => {
  test('no payments on or before due date returns pending', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result).toEqual({
      status: 'pending',
      amountDueMinor: 100000,
      isOverdue: false,
    });
  });

  test('partial payments on or before due date return partially_paid', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 40000,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result).toEqual({
      status: 'partially_paid',
      amountDueMinor: 60000,
      isOverdue: false,
    });
  });

  test('any unpaid balance after due date returns overdue', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-16',
    });

    expect(result).toEqual({
      status: 'overdue',
      amountDueMinor: 100000,
      isOverdue: true,
    });
  });

  test('partial unpaid balance after due date returns overdue', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 40000,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-16',
    });

    expect(result).toEqual({
      status: 'overdue',
      amountDueMinor: 60000,
      isOverdue: true,
    });
  });

  test('full payment before due date returns paid', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 100000,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-08',
    });

    expect(result).toEqual({
      status: 'paid',
      amountDueMinor: 0,
      isOverdue: false,
    });
  });

  test('full payment after due date still returns paid', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 100000,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-16',
    });

    expect(result).toEqual({
      status: 'paid',
      amountDueMinor: 0,
      isOverdue: false,
    });
  });

  test('the due date itself is not overdue', () => {
    const result = evaluateSettlement({
      totalMinor: 100000,
      amountPaidMinor: 0,
      dueDate: '2026-08-15',
      asOfUtcDate: '2026-08-15',
    });

    expect(result.status).toBe('pending');
    expect(result.isOverdue).toBe(false);
  });

  test('invalid total throws a ZodError', () => {
    expect(() =>
      evaluateSettlement({
        totalMinor: 0,
        amountPaidMinor: 0,
        dueDate: '2026-08-15',
        asOfUtcDate: '2026-08-08',
      }),
    ).toThrow(/Schema/i);
  });

  test('amount paid greater than total throws a ZodError', () => {
    expect(() =>
      evaluateSettlement({
        totalMinor: 100000,
        amountPaidMinor: 100001,
        dueDate: '2026-08-15',
        asOfUtcDate: '2026-08-08',
      }),
    ).toThrow(/Schema/i);
  });

  test('invalid date throws a ZodError', () => {
    expect(() =>
      evaluateSettlement({
        totalMinor: 100000,
        amountPaidMinor: 0,
        dueDate: 'invalid',
        asOfUtcDate: '2026-08-08',
      }),
    ).toThrow(/Schema/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/order-status/domain/evaluate.test.ts`
Expected: FAIL — module `@/modules/order-status/domain/evaluate` not found

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/order-status/domain/evaluate.ts`:

```typescript
import {
  settlementInputSchema,
  type SettlementInput,
  type SettlementStatus,
} from '@/modules/order-status/domain/schemas';

export interface SettlementResult {
  readonly status: SettlementStatus;
  readonly amountDueMinor: number;
  readonly isOverdue: boolean;
}

export function evaluateSettlement(input: SettlementInput): SettlementResult {
  const validated = settlementInputSchema.parse(input);
  const amountDueMinor = validated.totalMinor - validated.amountPaidMinor;

  const status: SettlementStatus = deriveStatus(
    validated.amountPaidMinor,
    validated.totalMinor,
    validated.asOfUtcDate,
    validated.dueDate,
  );

  return {
    status,
    amountDueMinor,
    isOverdue: status === 'overdue',
  };
}

function deriveStatus(
  amountPaidMinor: number,
  totalMinor: number,
  asOfUtcDate: string,
  dueDate: string,
): SettlementStatus {
  if (amountPaidMinor === totalMinor) {
    return 'paid';
  }

  if (asOfUtcDate > dueDate) {
    return 'overdue';
  }

  if (amountPaidMinor > 0) {
    return 'partially_paid';
  }

  return 'pending';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/order-status/domain/evaluate.test.ts`
Expected: PASS — all 10 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/order-status/domain/evaluate.ts src/modules/order-status/domain/evaluate.test.ts
git commit -m "feat: add pure order status evaluator"
```

---

## Task 3: Order Status — public contract

**Files:**

- Create: `src/modules/order-status/public.ts`

- [ ] **Step 1: Create the public contract**

Create `src/modules/order-status/public.ts`:

```typescript
export { evaluateSettlement } from '@/modules/order-status/domain/evaluate';
export type { SettlementResult } from '@/modules/order-status/domain/evaluate';
export {
  settlementInputSchema,
  settlementStatusSchema,
  type SettlementInput,
  type SettlementStatus,
} from '@/modules/order-status/domain/schemas';
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: PASS — no errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/order-status/public.ts
git commit -m "feat: expose order status public contract"
```

---

## Task 4: Orders — domain types and errors

**Files:**

- Create: `src/modules/orders/domain/types.ts`
- Create: `src/modules/orders/domain/errors.ts`

- [ ] **Step 1: Create the errors file**

Create `src/modules/orders/domain/errors.ts`:

```typescript
export type OrderErrorCode =
  'not_found' | 'payment_locked' | 'validation_failed';

export class OrderError extends Error {
  readonly code: OrderErrorCode;

  constructor(code: OrderErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'OrderError';
  }
}
```

- [ ] **Step 2: Create the types file**

Create `src/modules/orders/domain/types.ts`:

```typescript
import type { AuthenticatedMerchant } from '@/modules/identity/public';
import type { SettlementResult } from '@/modules/order-status/public';
import type {
  CreateOrderInput,
  ListOrdersQuery,
  UpdateOrderInput,
} from '@/modules/orders/domain/schemas';

export interface StoredLineItem {
  readonly id: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPriceMinor: number;
  readonly lineTotalMinor: number;
}

export interface StoredOrder {
  readonly id: string;
  readonly merchantId: string;
  readonly customer: string;
  readonly dueDate: string;
  readonly lineItems: readonly StoredLineItem[];
  readonly subtotalMinor: number;
  readonly totalMinor: number;
  readonly amountPaidMinor: number;
  readonly paymentCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface NewStoredOrder {
  readonly id: string;
  readonly merchantId: string;
  readonly customer: string;
  readonly dueDate: string;
  readonly lineItems: readonly StoredLineItem[];
  readonly subtotalMinor: number;
  readonly totalMinor: number;
  readonly amountPaidMinor: number;
  readonly paymentCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OrderResult {
  readonly id: string;
  readonly customerId: string;
  readonly customer: string;
  readonly dueDate: string;
  readonly lineItems: readonly StoredLineItem[];
  readonly subtotalMinor: number;
  readonly totalMinor: number;
  readonly amountPaidMinor: number;
  readonly amountDueMinor: number;
  readonly status: SettlementResult['status'];
  readonly paymentCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface OrderSummary {
  readonly id: string;
  readonly customer: string;
  readonly dueDate: string;
  readonly totalMinor: number;
  readonly amountPaidMinor: number;
  readonly amountDueMinor: number;
  readonly status: SettlementResult['status'];
  readonly paymentCount: number;
}

export interface CreateOrderResult extends OrderResult {}

export interface UpdateOrderResult extends OrderResult {}

export interface CreateOrderUseCase {
  createOrder(
    merchant: AuthenticatedMerchant,
    input: CreateOrderInput,
  ): Promise<CreateOrderResult>;
}

export interface ListOrdersUseCase {
  listOrders(
    merchant: AuthenticatedMerchant,
    query: ListOrdersQuery,
  ): Promise<readonly OrderSummary[]>;
}

export interface GetOrderUseCase {
  getOrder(
    merchant: AuthenticatedMerchant,
    orderId: string,
  ): Promise<OrderResult>;
}

export interface UpdateOrderUseCase {
  updateOrder(
    merchant: AuthenticatedMerchant,
    orderId: string,
    input: UpdateOrderInput,
  ): Promise<UpdateOrderResult>;
}

export interface DeleteOrderUseCase {
  deleteOrder(merchant: AuthenticatedMerchant, orderId: string): Promise<void>;
}
```

- [ ] **Step 3: Verify typecheck fails (schemas not yet created)**

Run: `npx tsc --noEmit`
Expected: FAIL — `@/modules/orders/domain/schemas` not found (this is expected; we create schemas in Task 5)

- [ ] **Step 4: Commit**

```bash
git add src/modules/orders/domain/types.ts src/modules/orders/domain/errors.ts
git commit -m "feat: define orders domain types and errors"
```

---

## Task 5: Orders — Zod schemas

**Files:**

- Create: `src/modules/orders/domain/schemas.ts`
- Create: `src/modules/orders/domain/schemas.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/orders/domain/schemas.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';

import {
  createOrderInputSchema,
  listOrdersQuerySchema,
  updateOrderInputSchema,
} from '@/modules/orders/domain/schemas';

describe('createOrderInputSchema', () => {
  test('accepts a valid order with line items', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    expect(result.success).toBe(true);
  });

  test('rejects an empty customer name', () => {
    const result = createOrderInputSchema.safeParse({
      customer: '',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    expect(result.success).toBe(false);
  });

  test('rejects an empty line items array', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [],
    });

    expect(result.success).toBe(false);
  });

  test('rejects a line item with empty description', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [{ description: '', quantity: 2, unitPriceMinor: 50000 }],
    });

    expect(result.success).toBe(false);
  });

  test('rejects quantity less than 1', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 0, unitPriceMinor: 50000 },
      ],
    });

    expect(result.success).toBe(false);
  });

  test('rejects non-integer quantity', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 1.5, unitPriceMinor: 50000 },
      ],
    });

    expect(result.success).toBe(false);
  });

  test('rejects unit price less than 1', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [{ description: 'Widget', quantity: 2, unitPriceMinor: 0 }],
    });

    expect(result.success).toBe(false);
  });

  test('rejects an invalid date format', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: 'not-a-date',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    expect(result.success).toBe(false);
  });

  test('strips client-supplied fields not in the schema', () => {
    const result = createOrderInputSchema.safeParse({
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
      totalMinor: 999999,
      merchantId: 'attacker-merchant',
      status: 'paid',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('totalMinor');
      expect(result.data).not.toHaveProperty('merchantId');
      expect(result.data).not.toHaveProperty('status');
    }
  });
});

describe('updateOrderInputSchema', () => {
  test('accepts a valid partial update', () => {
    const result = updateOrderInputSchema.safeParse({
      customer: 'Updated Corp',
      dueDate: '2026-08-20',
      lineItems: [
        { description: 'Gadget', quantity: 1, unitPriceMinor: 25000 },
      ],
    });

    expect(result.success).toBe(true);
  });

  test('accepts updating only customer', () => {
    const result = updateOrderInputSchema.safeParse({
      customer: 'New Name',
    });

    expect(result.success).toBe(true);
  });

  test('rejects empty customer', () => {
    const result = updateOrderInputSchema.safeParse({
      customer: '',
    });

    expect(result.success).toBe(false);
  });
});

describe('listOrdersQuerySchema', () => {
  test('accepts no status filter', () => {
    const result = listOrdersQuerySchema.safeParse({});

    expect(result.success).toBe(true);
  });

  test('accepts a valid status filter', () => {
    const result = listOrdersQuerySchema.safeParse({ status: 'pending' });

    expect(result.success).toBe(true);
  });

  test('rejects an invalid status', () => {
    const result = listOrdersQuerySchema.safeParse({ status: 'invalid' });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/orders/domain/schemas.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/orders/domain/schemas.ts`:

```typescript
import { z } from 'zod';

const customerSchema = z.string().trim().min(1, 'Customer name is required.');

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format.')
  .refine((value) => {
    const parsed = new Date(value + 'T00:00:00.000Z');
    return !Number.isNaN(parsed.getTime());
  }, 'Due date must be a valid calendar date.');

const lineItemInputSchema = z.object({
  description: z.string().trim().min(1, 'Description is required.'),
  quantity: z
    .number()
    .int('Quantity must be an integer.')
    .min(1, 'Quantity must be at least 1.'),
  unitPriceMinor: z
    .number()
    .int('Unit price must be an integer.')
    .min(1, 'Unit price must be at least 1 minor unit.'),
});

export const createOrderInputSchema = z.object({
  customer: customerSchema,
  dueDate: dateOnlySchema,
  lineItems: z
    .array(lineItemInputSchema)
    .min(1, 'At least one line item is required.'),
});

export const updateOrderInputSchema = z
  .object({
    customer: customerSchema.optional(),
    dueDate: dateOnlySchema.optional(),
    lineItems: z
      .array(lineItemInputSchema)
      .min(1, 'At least one line item is required.')
      .optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const listOrdersQuerySchema = z.object({
  status: z.enum(['pending', 'partially_paid', 'paid', 'overdue']).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderInputSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/orders/domain/schemas.test.ts`
Expected: PASS — all 14 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/orders/domain/schemas.ts src/modules/orders/domain/schemas.test.ts
git commit -m "feat: define order validation schemas"
```

---

## Task 6: Orders — pure totals computation

**Files:**

- Create: `src/modules/orders/domain/totals.ts`
- Create: `src/modules/orders/domain/totals.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/orders/domain/totals.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';

import {
  computeLineTotal,
  computeSubtotal,
} from '@/modules/orders/domain/totals';

describe('computeLineTotal', () => {
  test('multiplies quantity by unit price', () => {
    expect(computeLineTotal(2, 50000)).toBe(100000);
  });

  test('handles quantity of 1', () => {
    expect(computeLineTotal(1, 50000)).toBe(50000);
  });

  test('handles large values', () => {
    expect(computeLineTotal(100, 10000000)).toBe(1000000000);
  });
});

describe('computeSubtotal', () => {
  test('sums line totals', () => {
    expect(computeSubtotal([100000, 50000])).toBe(150000);
  });

  test('handles a single line item', () => {
    expect(computeSubtotal([100000])).toBe(100000);
  });

  test('handles the assignment example: 2 x 500 = 100000', () => {
    expect(computeSubtotal([computeLineTotal(2, 50000)])).toBe(100000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/orders/domain/totals.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/orders/domain/totals.ts`:

```typescript
export function computeLineTotal(
  quantity: number,
  unitPriceMinor: number,
): number {
  return quantity * unitPriceMinor;
}

export function computeSubtotal(lineTotals: readonly number[]): number {
  return lineTotals.reduce((sum, total) => sum + total, 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/orders/domain/totals.test.ts`
Expected: PASS — all 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/orders/domain/totals.ts src/modules/orders/domain/totals.test.ts
git commit -m "feat: add pure order totals computation"
```

---

## Task 7: Orders — domain ports

**Files:**

- Create: `src/modules/orders/domain/ports.ts`

- [ ] **Step 1: Create the ports file**

Create `src/modules/orders/domain/ports.ts`:

```typescript
import type {
  NewStoredOrder,
  StoredOrder,
} from '@/modules/orders/domain/types';

export interface OrderRepository {
  insert(order: NewStoredOrder): Promise<StoredOrder>;
  findById(merchantId: string, orderId: string): Promise<StoredOrder | null>;
  listActive(merchantId: string): Promise<readonly StoredOrder[]>;
  update(
    merchantId: string,
    orderId: string,
    changes: {
      customer: string;
      dueDate: string;
      lineItems: readonly StoredOrder['lineItems'];
      subtotalMinor: number;
      totalMinor: number;
      updatedAt: Date;
    },
  ): Promise<StoredOrder | null>;
  softDelete(
    merchantId: string,
    orderId: string,
    deletedAt: Date,
  ): Promise<StoredOrder | null>;
}

export interface OrderSettlementPort {
  reserveBalance(
    merchantId: string,
    orderId: string,
    requestedAmountMinor: number,
  ): Promise<
    | { succeeded: true; amountPaidMinor: number; paymentCount: number }
    | { succeeded: false; maximumAllowedAmountMinor: number }
  >;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  generate(): string;
}

export interface AuditLog {
  record(event: OrderAuditEvent): Promise<void>;
}

export interface OrderAuditEvent {
  action:
    | 'orders.create.succeeded'
    | 'orders.update.succeeded'
    | 'orders.delete.succeeded';
  occurredAt: Date;
  merchantId: string;
  orderId: string;
  actorId: string | null;
  changedFields: readonly string[];
}
```

- [ ] **Step 2: Verify typecheck passes for domain layer so far**

Run: `npx tsc --noEmit`
Expected: PASS — all domain types resolve

- [ ] **Step 3: Commit**

```bash
git add src/modules/orders/domain/ports.ts
git commit -m "feat: define orders domain ports"
```

---

## Task 8: Orders — in-memory test doubles

**Files:**

- Create: `src/modules/orders/application/test-doubles.ts`

- [ ] **Step 1: Create the test doubles**

Create `src/modules/orders/application/test-doubles.ts`:

```typescript
import type {
  AuditLog,
  Clock,
  IdGenerator,
  OrderAuditEvent,
  OrderRepository,
  OrderSettlementPort,
} from '@/modules/orders/domain/ports';
import type {
  NewStoredOrder,
  StoredOrder,
} from '@/modules/orders/domain/types';

export class InMemoryOrderRepository implements OrderRepository {
  readonly orders: StoredOrder[] = [];

  async insert(order: NewStoredOrder): Promise<StoredOrder> {
    const stored: StoredOrder = { ...order, deletedAt: null };
    this.orders.push(stored);
    return stored;
  }

  async findById(
    merchantId: string,
    orderId: string,
  ): Promise<StoredOrder | null> {
    return (
      this.orders.find(
        (order) =>
          order.id === orderId &&
          order.merchantId === merchantId &&
          order.deletedAt === null,
      ) ?? null
    );
  }

  async listActive(merchantId: string): Promise<readonly StoredOrder[]> {
    return this.orders.filter(
      (order) => order.merchantId === merchantId && order.deletedAt === null,
    );
  }

  async update(
    merchantId: string,
    orderId: string,
    changes: {
      customer: string;
      dueDate: string;
      lineItems: readonly StoredOrder['lineItems'];
      subtotalMinor: number;
      totalMinor: number;
      updatedAt: Date;
    },
  ): Promise<StoredOrder | null> {
    const order = this.orders.find(
      (o) =>
        o.id === orderId && o.merchantId === merchantId && o.deletedAt === null,
    );

    if (order === undefined) {
      return null;
    }

    order.customer = changes.customer;
    order.dueDate = changes.dueDate;
    order.lineItems = changes.lineItems;
    order.subtotalMinor = changes.subtotalMinor;
    order.totalMinor = changes.totalMinor;
    order.updatedAt = changes.updatedAt;
    return { ...order };
  }

  async softDelete(
    merchantId: string,
    orderId: string,
    deletedAt: Date,
  ): Promise<StoredOrder | null> {
    const order = this.orders.find(
      (o) =>
        o.id === orderId && o.merchantId === merchantId && o.deletedAt === null,
    );

    if (order === undefined) {
      return null;
    }

    order.deletedAt = deletedAt;
    return { ...order };
  }
}

export class InMemoryAuditLog implements AuditLog {
  readonly events: OrderAuditEvent[] = [];

  async record(event: OrderAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

export class FixedClock implements Clock {
  #value: Date;

  constructor(value: Date) {
    this.#value = value;
  }

  now(): Date {
    return this.#value;
  }

  set(value: Date): void {
    this.#value = value;
  }
}

export class StubIdGenerator implements IdGenerator {
  readonly #ids: string[];
  #index = 0;

  constructor(ids: string[]) {
    this.#ids = ids;
  }

  generate(): string {
    const id = this.#ids[this.#index];

    if (id === undefined) {
      throw new Error('No identifier available');
    }

    this.#index += 1;
    return id;
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/orders/application/test-doubles.ts
git commit -m "feat: add orders in-memory test doubles"
```

---

## Task 9: Orders — OrderService application logic (TDD)

**Files:**

- Create: `src/modules/orders/application/order-service.test.ts`
- Create: `src/modules/orders/application/order-service.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/orders/application/order-service.test.ts`:

```typescript
import { describe, expect, test } from 'vitest';

import { OrderService } from '@/modules/orders/application/order-service';
import { OrderError } from '@/modules/orders/domain/errors';
import {
  FixedClock,
  InMemoryAuditLog,
  InMemoryOrderRepository,
  StubIdGenerator,
} from '@/modules/orders/application/test-doubles';
import type { AuthenticatedMerchant } from '@/modules/identity/public';

const MERCHANT: AuthenticatedMerchant = {
  userId: 'user-1',
  merchantId: 'merchant-1',
};

const OTHER_MERCHANT: AuthenticatedMerchant = {
  userId: 'user-2',
  merchantId: 'merchant-2',
};

const NOW = new Date('2026-08-08T10:00:00.000Z');

function createService() {
  const orders = new InMemoryOrderRepository();
  const audit = new InMemoryAuditLog();
  const clock = new FixedClock(NOW);
  const ids = new StubIdGenerator(['order-1', 'line-1', 'line-2']);

  const service = new OrderService({
    orders,
    audit,
    clock,
    ids,
  });

  return { service, orders, audit, clock, ids };
}

describe('OrderService.createOrder', () => {
  test('creates an order with server-computed totals', async () => {
    const { service, orders, audit } = createService();

    const result = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    expect(result.totalMinor).toBe(100000);
    expect(result.subtotalMinor).toBe(100000);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]?.lineTotalMinor).toBe(100000);
    expect(result.amountPaidMinor).toBe(0);
    expect(result.paymentCount).toBe(0);
    expect(result.amountDueMinor).toBe(100000);
    expect(result.status).toBe('pending');
    expect(orders.orders).toHaveLength(1);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.action).toBe('orders.create.succeeded');
  });

  test('computes totals across multiple line items', async () => {
    const { service } = createService();

    const result = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
        { description: 'Gadget', quantity: 1, unitPriceMinor: 25000 },
      ],
    });

    expect(result.subtotalMinor).toBe(125000);
    expect(result.totalMinor).toBe(125000);
  });
});

describe('OrderService.getOrder', () => {
  test('returns an order with derived status', async () => {
    const { service } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    const result = await service.getOrder(MERCHANT, created.id);

    expect(result.id).toBe(created.id);
    expect(result.status).toBe('pending');
  });

  test("throws not_found for another merchant's order", async () => {
    const { service } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    await expect(
      service.getOrder(OTHER_MERCHANT, created.id),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  test('throws not_found for a non-existent order', async () => {
    const { service } = createService();

    await expect(
      service.getOrder(MERCHANT, 'nonexistent'),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('OrderService.listOrders', () => {
  test('returns only active orders for the current merchant', async () => {
    const { service } = createService();

    await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    await service.createOrder(OTHER_MERCHANT, {
      customer: 'Other Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 1, unitPriceMinor: 50000 },
      ],
    });

    const result = await service.listOrders(MERCHANT, {});

    expect(result).toHaveLength(1);
    expect(result[0]?.customer).toBe('Acme Corp');
  });
});

describe('OrderService.updateOrder', () => {
  test('updates an order with paymentCount zero', async () => {
    const { service, audit } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    const result = await service.updateOrder(MERCHANT, created.id, {
      customer: 'Updated Corp',
    });

    expect(result.customer).toBe('Updated Corp');
    expect(audit.events).toContainEqual(
      expect.objectContaining({
        action: 'orders.update.succeeded',
        changedFields: ['customer'],
      }),
    );
  });

  test('throws payment_locked for an order with payments', async () => {
    const { service } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    // Simulate a payment by directly modifying the in-memory store
    const { orders } = createService();
    // Create a fresh service that reuses the modified store
    const orders2 = new InMemoryOrderRepository();
    const audit2 = new InMemoryAuditLog();
    const service2 = new OrderService({
      orders: orders2,
      audit: audit2,
      clock: new FixedClock(new Date('2026-08-08T10:00:00.000Z')),
      ids: new StubIdGenerator(['order-locked', 'line-1']),
    });
    const locked = await service2.createOrder(MERCHANT, {
      customer: 'Locked Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 1, unitPriceMinor: 50000 },
      ],
    });

    (orders2.orders[0] as { paymentCount: number }).paymentCount = 1;

    await expect(
      service2.updateOrder(MERCHANT, locked.id, {
        customer: 'Updated',
      }),
    ).rejects.toMatchObject({ code: 'payment_locked' });
  });

  test("throws not_found for another merchant's order", async () => {
    const { service } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    await expect(
      service.updateOrder(OTHER_MERCHANT, created.id, {
        customer: 'Hacked',
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('OrderService.deleteOrder', () => {
  test('soft-deletes an order with paymentCount zero', async () => {
    const { service, orders, audit } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    await service.deleteOrder(MERCHANT, created.id);

    expect(orders.orders[0]?.deletedAt).toEqual(NOW);
    expect(audit.events).toContainEqual(
      expect.objectContaining({
        action: 'orders.delete.succeeded',
      }),
    );
  });

  test('soft-deleted order is absent from list and detail', async () => {
    const { service } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    await service.deleteOrder(MERCHANT, created.id);

    await expect(service.getOrder(MERCHANT, created.id)).rejects.toMatchObject({
      code: 'not_found',
    });
    const list = await service.listOrders(MERCHANT, {});
    expect(list).toHaveLength(0);
  });

  test('throws payment_locked for an order with payments', async () => {
    const { service, orders } = createService();

    const created = await service.createOrder(MERCHANT, {
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
      ],
    });

    (orders.orders[0] as { paymentCount: number }).paymentCount = 1;

    await expect(
      service.deleteOrder(MERCHANT, created.id),
    ).rejects.toMatchObject({ code: 'payment_locked' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/orders/application/order-service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/modules/orders/application/order-service.ts`:

```typescript
import { OrderError } from '@/modules/orders/domain/errors';
import type {
  AuditLog,
  Clock,
  IdGenerator,
  OrderRepository,
} from '@/modules/orders/domain/ports';
import {
  createOrderInputSchema,
  listOrdersQuerySchema,
  updateOrderInputSchema,
  type CreateOrderInput,
  type ListOrdersQuery,
  type UpdateOrderInput,
} from '@/modules/orders/domain/schemas';
import {
  computeLineTotal,
  computeSubtotal,
} from '@/modules/orders/domain/totals';
import type { AuthenticatedMerchant } from '@/modules/identity/public';
import type {
  OrderResult,
  OrderSummary,
  StoredLineItem,
} from '@/modules/orders/domain/types';
import { NewStoredOrder, StoredOrder } from '@/modules/orders/domain/types';
import { evaluateSettlement } from '@/modules/order-status/public';

const NOT_FOUND_ERROR = new OrderError('not_found');

type OrderServiceDependencies = {
  orders: OrderRepository;
  audit: AuditLog;
  clock: Clock;
  ids: IdGenerator;
};

export class OrderService {
  readonly #orders: OrderRepository;
  readonly #audit: AuditLog;
  readonly #clock: Clock;
  readonly #ids: IdGenerator;

  constructor(dependencies: OrderServiceDependencies) {
    this.#orders = dependencies.orders;
    this.#audit = dependencies.audit;
    this.#clock = dependencies.clock;
    this.#ids = dependencies.ids;
  }

  async createOrder(
    merchant: AuthenticatedMerchant,
    input: CreateOrderInput,
  ): Promise<OrderResult> {
    const validated = createOrderInputSchema.parse(input);
    const now = this.#clock.now();

    const lineItems: StoredLineItem[] = validated.lineItems.map((item) => ({
      id: this.#ids.generate(),
      description: item.description,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      lineTotalMinor: computeLineTotal(item.quantity, item.unitPriceMinor),
    }));

    const subtotalMinor = computeSubtotal(
      lineItems.map((item) => item.lineTotalMinor),
    );

    const order: NewStoredOrder = {
      id: this.#ids.generate(),
      merchantId: merchant.merchantId,
      customer: validated.customer,
      dueDate: validated.dueDate,
      lineItems,
      subtotalMinor,
      totalMinor: subtotalMinor,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const stored = await this.#orders.insert(order);

    await this.#audit.record({
      action: 'orders.create.succeeded',
      occurredAt: now,
      merchantId: merchant.merchantId,
      orderId: stored.id,
      actorId: merchant.userId,
      changedFields: [],
    });

    return toOrderResult(stored);
  }

  async listOrders(
    merchant: AuthenticatedMerchant,
    query: ListOrdersQuery,
  ): Promise<readonly OrderSummary[]> {
    const validated = listOrdersQuerySchema.parse(query);
    const orders = await this.#orders.listActive(merchant.merchantId);

    const summaries = orders.map((order) => toOrderSummary(order));

    if (validated.status === undefined) {
      return summaries;
    }

    return summaries.filter((summary) => summary.status === validated.status);
  }

  async getOrder(
    merchant: AuthenticatedMerchant,
    orderId: string,
  ): Promise<OrderResult> {
    const order = await this.#orders.findById(merchant.merchantId, orderId);

    if (order === null) {
      throw NOT_FOUND_ERROR;
    }

    return toOrderResult(order);
  }

  async updateOrder(
    merchant: AuthenticatedMerchant,
    orderId: string,
    input: UpdateOrderInput,
  ): Promise<OrderResult> {
    const validated = updateOrderInputSchema.parse(input);
    const order = await this.#orders.findById(merchant.merchantId, orderId);

    if (order === null) {
      throw NOT_FOUND_ERROR;
    }

    if (order.paymentCount > 0) {
      throw new OrderError('payment_locked');
    }

    const now = this.#clock.now();
    const customer = validated.customer ?? order.customer;
    const dueDate = validated.dueDate ?? order.dueDate;
    const changedFields: string[] = [];
    if (validated.customer !== undefined) {
      changedFields.push('customer');
    }
    if (validated.dueDate !== undefined) {
      changedFields.push('dueDate');
    }

    let lineItems = order.lineItems;
    let subtotalMinor = order.subtotalMinor;
    let totalMinor = order.totalMinor;

    if (validated.lineItems !== undefined) {
      lineItems = validated.lineItems.map((item) => ({
        id: this.#ids.generate(),
        description: item.description,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        lineTotalMinor: computeLineTotal(item.quantity, item.unitPriceMinor),
      }));
      subtotalMinor = computeSubtotal(
        lineItems.map((item) => item.lineTotalMinor),
      );
      totalMinor = subtotalMinor;
      changedFields.push('lineItems');
    }

    const updated = await this.#orders.update(merchant.merchantId, orderId, {
      customer,
      dueDate,
      lineItems,
      subtotalMinor,
      totalMinor,
      updatedAt: now,
    });

    if (updated === null) {
      throw NOT_FOUND_ERROR;
    }

    await this.#audit.record({
      action: 'orders.update.succeeded',
      occurredAt: now,
      merchantId: merchant.merchantId,
      orderId: updated.id,
      actorId: merchant.userId,
      changedFields,
    });

    return toOrderResult(updated);
  }

  async deleteOrder(
    merchant: AuthenticatedMerchant,
    orderId: string,
  ): Promise<void> {
    const order = await this.#orders.findById(merchant.merchantId, orderId);

    if (order === null) {
      throw NOT_FOUND_ERROR;
    }

    if (order.paymentCount > 0) {
      throw new OrderError('payment_locked');
    }

    const now = this.#clock.now();
    const deleted = await this.#orders.softDelete(
      merchant.merchantId,
      orderId,
      now,
    );

    if (deleted === null) {
      throw NOT_FOUND_ERROR;
    }

    await this.#audit.record({
      action: 'orders.delete.succeeded',
      occurredAt: now,
      merchantId: merchant.merchantId,
      orderId: deleted.id,
      actorId: merchant.userId,
      changedFields: [],
    });
  }
}

function toOrderResult(order: StoredOrder): OrderResult {
  const settlement = evaluateSettlement({
    totalMinor: order.totalMinor,
    amountPaidMinor: order.amountPaidMinor,
    dueDate: order.dueDate,
    asOfUtcDate: toUtcDateString(new Date()),
  });

  return {
    id: order.id,
    customerId: order.id,
    customer: order.customer,
    dueDate: order.dueDate,
    lineItems: order.lineItems,
    subtotalMinor: order.subtotalMinor,
    totalMinor: order.totalMinor,
    amountPaidMinor: order.amountPaidMinor,
    amountDueMinor: settlement.amountDueMinor,
    status: settlement.status,
    paymentCount: order.paymentCount,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function toOrderSummary(order: StoredOrder): OrderSummary {
  const settlement = evaluateSettlement({
    totalMinor: order.totalMinor,
    amountPaidMinor: order.amountPaidMinor,
    dueDate: order.dueDate,
    asOfUtcDate: toUtcDateString(new Date()),
  });

  return {
    id: order.id,
    customer: order.customer,
    dueDate: order.dueDate,
    totalMinor: order.totalMinor,
    amountPaidMinor: order.amountPaidMinor,
    amountDueMinor: settlement.amountDueMinor,
    status: settlement.status,
    paymentCount: order.paymentCount,
  };
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/orders/application/order-service.test.ts`
Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/orders/application/order-service.ts src/modules/orders/application/order-service.test.ts
git commit -m "feat: add order service application logic"
```

---

## Task 10: Orders — public contract

**Files:**

- Create: `src/modules/orders/public.ts`

- [ ] **Step 1: Create the public contract**

Create `src/modules/orders/public.ts`:

```typescript
export {
  createOrderInputSchema,
  listOrdersQuerySchema,
  updateOrderInputSchema,
  type CreateOrderInput,
  type ListOrdersQuery,
  type UpdateOrderInput,
} from '@/modules/orders/domain/schemas';
export {
  OrderError,
  type OrderErrorCode,
} from '@/modules/orders/domain/errors';
export type {
  CreateOrderResult,
  CreateOrderUseCase,
  DeleteOrderUseCase,
  GetOrderUseCase,
  ListOrdersUseCase,
  OrderResult,
  OrderSummary,
  StoredLineItem,
  UpdateOrderResult,
  UpdateOrderUseCase,
} from '@/modules/orders/domain/types';

export async function composeOrdersService(): Promise<
  import('@/modules/orders/application/order-service').OrderService
> {
  const { createOrdersModule } =
    await import('@/modules/orders/infrastructure/create-orders-module');
  return createOrdersModule();
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: PASS (infrastructure files not yet created, but the dynamic import won't be checked at this stage)

Note: If typecheck fails because `create-orders-module` doesn't exist yet, temporarily comment out the `composeOrdersService` function body and add it back in Task 12 when the factory exists.

- [ ] **Step 3: Commit**

```bash
git add src/modules/orders/public.ts
git commit -m "feat: expose orders public contract"
```

---

## Task 11: Orders — MongoDB infrastructure adapters

**Files:**

- Create: `src/modules/orders/infrastructure/mongo-order-repository.ts`
- Create: `src/modules/orders/infrastructure/mongo-order-audit-log.ts`
- Create: `src/modules/orders/infrastructure/mongo-order-settlement-port.ts`
- Create: `src/modules/orders/infrastructure/ensure-indexes.ts`

- [ ] **Step 1: Create the Mongo order repository**

Create `src/modules/orders/infrastructure/mongo-order-repository.ts`:

```typescript
import type { ClientSession, Collection, Db, WithId } from 'mongodb';

import type { OrderRepository } from '@/modules/orders/domain/ports';
import type {
  NewStoredOrder,
  StoredLineItem,
  StoredOrder,
} from '@/modules/orders/domain/types';

type OrderDocument = {
  id: string;
  merchantId: string;
  customer: string;
  dueDate: string;
  lineItems: StoredLineItem[];
  subtotalMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  paymentCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export class MongoOrderRepository implements OrderRepository {
  readonly #collection: Collection<OrderDocument>;
  readonly #session: ClientSession | undefined;

  constructor(database: Db, session?: ClientSession) {
    this.#collection = database.collection<OrderDocument>('orders');
    this.#session = session;
  }

  async insert(order: NewStoredOrder): Promise<StoredOrder> {
    await this.#collection.insertOne(
      {
        id: order.id,
        merchantId: order.merchantId,
        customer: order.customer,
        dueDate: order.dueDate,
        lineItems: [...order.lineItems],
        subtotalMinor: order.subtotalMinor,
        totalMinor: order.totalMinor,
        amountPaidMinor: order.amountPaidMinor,
        paymentCount: order.paymentCount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        deletedAt: null,
      },
      { session: this.#session },
    );

    return {
      ...order,
      deletedAt: null,
    };
  }

  async findById(
    merchantId: string,
    orderId: string,
  ): Promise<StoredOrder | null> {
    const document = await this.#collection.findOne(
      {
        id: orderId,
        merchantId,
        deletedAt: null,
      },
      { session: this.#session },
    );

    return document === null ? null : toStoredOrder(document);
  }

  async listActive(merchantId: string): Promise<readonly StoredOrder[]> {
    const cursor = this.#collection.find(
      { merchantId, deletedAt: null },
      { session: this.#session },
    );

    const documents = await cursor.toArray();
    return documents.map(toStoredOrder);
  }

  async update(
    merchantId: string,
    orderId: string,
    changes: {
      customer: string;
      dueDate: string;
      lineItems: readonly StoredLineItem[];
      subtotalMinor: number;
      totalMinor: number;
      updatedAt: Date;
    },
  ): Promise<StoredOrder | null> {
    const document = await this.#collection.findOneAndUpdate(
      {
        id: orderId,
        merchantId,
        deletedAt: null,
      },
      {
        $set: {
          customer: changes.customer,
          dueDate: changes.dueDate,
          lineItems: [...changes.lineItems],
          subtotalMinor: changes.subtotalMinor,
          totalMinor: changes.totalMinor,
          updatedAt: changes.updatedAt,
        },
      },
      { returnDocument: 'after', session: this.#session },
    );

    return document === null ? null : toStoredOrder(document);
  }

  async softDelete(
    merchantId: string,
    orderId: string,
    deletedAt: Date,
  ): Promise<StoredOrder | null> {
    const document = await this.#collection.findOneAndUpdate(
      {
        id: orderId,
        merchantId,
        deletedAt: null,
      },
      { $set: { deletedAt } },
      { returnDocument: 'after', session: this.#session },
    );

    return document === null ? null : toStoredOrder(document);
  }
}

function toStoredOrder(document: WithId<OrderDocument>): StoredOrder {
  return {
    id: document.id,
    merchantId: document.merchantId,
    customer: document.customer,
    dueDate: document.dueDate,
    lineItems: document.lineItems,
    subtotalMinor: document.subtotalMinor,
    totalMinor: document.totalMinor,
    amountPaidMinor: document.amountPaidMinor,
    paymentCount: document.paymentCount,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    deletedAt: document.deletedAt,
  };
}
```

- [ ] **Step 2: Create the Mongo order audit log**

Create `src/modules/orders/infrastructure/mongo-order-audit-log.ts`:

```typescript
import type { ClientSession, Collection, Db } from 'mongodb';

import type { AuditLog, OrderAuditEvent } from '@/modules/orders/domain/ports';

type OrderAuditDocument = {
  action: OrderAuditEvent['action'];
  occurredAt: Date;
  merchantId: string;
  orderId: string;
  actorId: string | null;
  changedFields: readonly string[];
};

export class MongoOrderAuditLog implements AuditLog {
  readonly #collection: Collection<OrderAuditDocument>;
  readonly #session: ClientSession | undefined;

  constructor(database: Db, session?: ClientSession) {
    this.#collection =
      database.collection<OrderAuditDocument>('orders_audit_log');
    this.#session = session;
  }

  async record(event: OrderAuditEvent): Promise<void> {
    await this.#collection.insertOne(
      {
        action: event.action,
        occurredAt: event.occurredAt,
        merchantId: event.merchantId,
        orderId: event.orderId,
        actorId: event.actorId,
        changedFields: [...event.changedFields],
      },
      { session: this.#session },
    );
  }
}
```

- [ ] **Step 3: Create the Mongo order settlement port**

Create `src/modules/orders/infrastructure/mongo-order-settlement-port.ts`:

```typescript
import type { ClientSession, Collection, Db } from 'mongodb';

import type { OrderSettlementPort } from '@/modules/orders/domain/ports';

type OrderDocument = {
  id: string;
  merchantId: string;
  totalMinor: number;
  amountPaidMinor: number;
  paymentCount: number;
  deletedAt: Date | null;
};

export class MongoOrderSettlementPort implements OrderSettlementPort {
  readonly #collection: Collection<OrderDocument>;
  readonly #session: ClientSession;

  constructor(database: Db, session: ClientSession) {
    this.#collection = database.collection<OrderDocument>('orders');
    this.#session = session;
  }

  async reserveBalance(
    merchantId: string,
    orderId: string,
    requestedAmountMinor: number,
  ): Promise<
    | { succeeded: true; amountPaidMinor: number; paymentCount: number }
    | { succeeded: false; maximumAllowedAmountMinor: number }
  > {
    const result = await this.#collection.findOneAndUpdate(
      {
        id: orderId,
        merchantId,
        deletedAt: null,
        $expr: {
          $lte: [
            { $add: ['$amountPaidMinor', requestedAmountMinor] },
            '$totalMinor',
          ],
        },
      },
      {
        $inc: {
          amountPaidMinor: requestedAmountMinor,
          paymentCount: 1,
        },
      },
      {
        returnDocument: 'after',
        session: this.#session,
      },
    );

    if (result === null) {
      const order = await this.#collection.findOne(
        { id: orderId, merchantId, deletedAt: null },
        { session: this.#session },
      );

      const maximumAllowedAmountMinor =
        order === null ? 0 : order.totalMinor - order.amountPaidMinor;

      return { succeeded: false, maximumAllowedAmountMinor };
    }

    return {
      succeeded: true,
      amountPaidMinor: result.amountPaidMinor,
      paymentCount: result.paymentCount,
    };
  }
}
```

- [ ] **Step 4: Create the ensure-indexes function**

Create `src/modules/orders/infrastructure/ensure-indexes.ts`:

```typescript
import type { Db } from 'mongodb';

export async function ensureOrderIndexes(database: Db): Promise<void> {
  await Promise.all([
    database
      .collection('orders')
      .createIndex(
        { merchantId: 1, createdAt: -1 },
        { name: 'merchantId_createdAt' },
      ),
    database
      .collection('orders')
      .createIndex(
        { merchantId: 1, dueDate: 1 },
        { name: 'merchantId_dueDate' },
      ),
    database
      .collection('orders')
      .createIndex(
        { merchantId: 1, deletedAt: 1 },
        { name: 'merchantId_deletedAt' },
      ),
  ]);
}
```

- [ ] **Step 5: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/orders/infrastructure/mongo-order-repository.ts \
  src/modules/orders/infrastructure/mongo-order-audit-log.ts \
  src/modules/orders/infrastructure/mongo-order-settlement-port.ts \
  src/modules/orders/infrastructure/ensure-indexes.ts
git commit -m "feat: add orders MongoDB infrastructure adapters"
```

---

## Task 12: Orders — create-orders-module factory

**Files:**

- Create: `src/modules/orders/infrastructure/create-orders-module.ts`

- [ ] **Step 1: Create the factory**

Create `src/modules/orders/infrastructure/create-orders-module.ts`:

```typescript
import { OrderService } from '@/modules/orders/application/order-service';
import { MongoOrderAuditLog } from '@/modules/orders/infrastructure/mongo-order-audit-log';
import { MongoOrderRepository } from '@/modules/orders/infrastructure/mongo-order-repository';
import { ensureOrderIndexes } from '@/modules/orders/infrastructure/ensure-indexes';
import { CryptoIdGenerator } from '@/modules/identity/infrastructure/crypto-id-generator';
import { SystemClock } from '@/modules/identity/infrastructure/system-clock';
import { loadEnvironment } from '@/shared/config/environment';
import { getMongoClient } from '@/shared/mongodb/client';

let ordersModulePromise: Promise<OrderService> | undefined;

export function createOrdersModule(): Promise<OrderService> {
  ordersModulePromise ??= createOrdersModuleInternal();

  return ordersModulePromise;
}

async function createOrdersModuleInternal(): Promise<OrderService> {
  const environment = loadEnvironment(process.env);
  const client = await getMongoClient();
  const database = client.db(environment.mongodbDatabaseName);

  await ensureOrderIndexes(database);

  return new OrderService({
    orders: new MongoOrderRepository(database),
    audit: new MongoOrderAuditLog(database),
    clock: new SystemClock(),
    ids: new CryptoIdGenerator(),
  });
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/orders/infrastructure/create-orders-module.ts
git commit -m "feat: add orders module factory"
```

---

## Task 13: Orders — integration tests against MongoDB

**Files:**

- Create: `tests/integration/orders/infrastructure.test.ts`

- [ ] **Step 1: Write integration tests**

Create `tests/integration/orders/infrastructure.test.ts`:

```typescript
import { randomUUID } from 'node:crypto';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { type Db, MongoClient } from 'mongodb';

import { ensureOrderIndexes } from '@/modules/orders/infrastructure/ensure-indexes';
import { MongoOrderAuditLog } from '@/modules/orders/infrastructure/mongo-order-audit-log';
import { MongoOrderRepository } from '@/modules/orders/infrastructure/mongo-order-repository';
import { resolveMongoClientOptions } from '@/shared/mongodb/client';

const mongodbUri = 'mongodb://localhost:27018/?replicaSet=rs0';
const databaseName = `crossval_orders_test_${randomUUID()}`;

describe('orders infrastructure adapters', () => {
  let client: MongoClient;
  let database: Db;

  beforeAll(async () => {
    client = await MongoClient.connect(
      mongodbUri,
      resolveMongoClientOptions(mongodbUri),
    );
    database = client.db(databaseName);
    await ensureOrderIndexes(database);
  });

  beforeEach(async () => {
    await database.dropDatabase();
    await ensureOrderIndexes(database);
  });

  afterAll(async () => {
    await database.dropDatabase();
    await client.close();
  });

  test('inserts and retrieves an order by merchant and id', async () => {
    const repo = new MongoOrderRepository(database);
    const now = new Date('2026-08-08T10:00:00.000Z');

    const inserted = await repo.insert({
      id: 'order-1',
      merchantId: 'merchant-1',
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [
        {
          id: 'line-1',
          description: 'Widget',
          quantity: 2,
          unitPriceMinor: 50000,
          lineTotalMinor: 100000,
        },
      ],
      subtotalMinor: 100000,
      totalMinor: 100000,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const found = await repo.findById('merchant-1', 'order-1');
    expect(found).not.toBeNull();
    expect(found?.customer).toBe('Acme Corp');
    expect(found?.totalMinor).toBe(100000);
    expect(found?.deletedAt).toBeNull();
  });

  test('cross-merchant findById returns null', async () => {
    const repo = new MongoOrderRepository(database);
    const now = new Date();

    await repo.insert({
      id: 'order-1',
      merchantId: 'merchant-1',
      customer: 'Acme Corp',
      dueDate: '2026-08-15',
      lineItems: [],
      subtotalMinor: 0,
      totalMinor: 0,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const found = await repo.findById('merchant-2', 'order-1');
    expect(found).toBeNull();
  });

  test('listActive returns only active orders for the merchant', async () => {
    const repo = new MongoOrderRepository(database);
    const now = new Date();

    await repo.insert({
      id: 'order-1',
      merchantId: 'merchant-1',
      customer: 'Acme',
      dueDate: '2026-08-15',
      lineItems: [],
      subtotalMinor: 0,
      totalMinor: 0,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await repo.softDelete('merchant-1', 'order-1', now);

    await repo.insert({
      id: 'order-2',
      merchantId: 'merchant-1',
      customer: 'Other',
      dueDate: '2026-08-15',
      lineItems: [],
      subtotalMinor: 0,
      totalMinor: 0,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const list = await repo.listActive('merchant-1');
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('order-2');
  });

  test('update changes customer and dueDate', async () => {
    const repo = new MongoOrderRepository(database);
    const now = new Date();

    await repo.insert({
      id: 'order-1',
      merchantId: 'merchant-1',
      customer: 'Acme',
      dueDate: '2026-08-15',
      lineItems: [],
      subtotalMinor: 0,
      totalMinor: 0,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const updated = await repo.update('merchant-1', 'order-1', {
      customer: 'Updated',
      dueDate: '2026-08-20',
      lineItems: [],
      subtotalMinor: 0,
      totalMinor: 0,
      updatedAt: new Date(),
    });

    expect(updated?.customer).toBe('Updated');
    expect(updated?.dueDate).toBe('2026-08-20');
  });

  test('softDelete sets deletedAt and hides from reads', async () => {
    const repo = new MongoOrderRepository(database);
    const now = new Date();

    await repo.insert({
      id: 'order-1',
      merchantId: 'merchant-1',
      customer: 'Acme',
      dueDate: '2026-08-15',
      lineItems: [],
      subtotalMinor: 0,
      totalMinor: 0,
      amountPaidMinor: 0,
      paymentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const deleted = await repo.softDelete('merchant-1', 'order-1', now);
    expect(deleted?.deletedAt).toEqual(now);

    const found = await repo.findById('merchant-1', 'order-1');
    expect(found).toBeNull();
  });

  test('audit log records order events', async () => {
    const audit = new MongoOrderAuditLog(database);
    const now = new Date();

    await audit.record({
      action: 'orders.create.succeeded',
      occurredAt: now,
      merchantId: 'merchant-1',
      orderId: 'order-1',
      actorId: 'user-1',
      changedFields: [],
    });

    const docs = await database.collection('orders_audit_log').find().toArray();

    expect(docs).toHaveLength(1);
    expect(docs[0]?.action).toBe('orders.create.succeeded');
    expect(docs[0]?.orderId).toBe('order-1');
  });
});
```

- [ ] **Step 2: Run integration tests (requires Docker MongoDB running)**

Run: `docker compose up -d && npx vitest run tests/integration/orders/infrastructure.test.ts`
Expected: PASS — all 6 tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/integration/orders/infrastructure.test.ts
git commit -m "test: add orders infrastructure integration tests"
```

---

## Task 14: Orders — composition error mapping

**Files:**

- Create: `src/app/composition/orders-api-errors.ts`

- [ ] **Step 1: Create the orders API error mapper**

Create `src/app/composition/orders-api-errors.ts`:

```typescript
import { OrderError, type OrderErrorCode } from '@/modules/orders/public';
import { errorResponse, mapErrorResponse } from '@/shared/http/api-response';
import type { NextResponse } from 'next/server';

const orderErrorStatus: Record<OrderErrorCode, number> = {
  not_found: 404,
  payment_locked: 409,
  validation_failed: 400,
};

const orderErrorCode: Record<OrderErrorCode, string> = {
  not_found: 'NOT_FOUND',
  payment_locked: 'PAYMENT_LOCKED',
  validation_failed: 'VALIDATION_ERROR',
};

const orderErrorMessage: Record<OrderErrorCode, string> = {
  not_found: 'The requested order was not found.',
  payment_locked:
    'This order has payments recorded and cannot be modified or deleted.',
  validation_failed: 'The request contained invalid data.',
};

export function mapOrdersApiErrorResponse(
  error: unknown,
  requestId: string,
): NextResponse {
  if (error instanceof OrderError) {
    return errorResponse({
      status: orderErrorStatus[error.code],
      requestId,
      code: orderErrorCode[error.code],
      message: orderErrorMessage[error.code],
    });
  }

  return mapErrorResponse(error, requestId);
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/composition/orders-api-errors.ts
git commit -m "feat: add orders API error mapping"
```

---

## Task 15: Orders — HTTP route handlers (collection)

**Files:**

- Create: `src/app/api/v1/orders/route.ts`

- [ ] **Step 1: Create the list + create route handler**

Create `src/app/api/v1/orders/route.ts`:

```typescript
import { type NextRequest, NextResponse } from 'next/server';

import { composeIdentityService } from '@/modules/identity/public';
import { composeOrdersService } from '@/modules/orders/public';
import {
  createOrderInputSchema,
  listOrdersQuerySchema,
} from '@/modules/orders/public';
import { dataResponse, InvalidJsonError } from '@/shared/http/api-response';
import { mapApiErrorResponse } from '@/app/composition/api-errors';
import { mapOrdersApiErrorResponse } from '@/app/composition/orders-api-errors';
import { createRequestContext } from '@/shared/http/request-context';
import { loadEnvironment } from '@/shared/config/environment';
import { assertSameOrigin } from '@/shared/http/same-origin';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = createRequestContext(request);

  try {
    if (context.sessionToken === null) {
      return mapApiErrorResponse(
        new (await import('@/modules/identity/public')).IdentityError(
          'unauthorized',
        ),
        context.requestId,
      );
    }

    const identityService = await composeIdentityService();
    const merchant = await identityService.requireMerchant(
      context.sessionToken,
    );

    const query = listOrdersQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const ordersService = await composeOrdersService();
    const orders = await ordersService.listOrders(merchant, query);

    return dataResponse({ orders });
  } catch (error: unknown) {
    return mapOrdersApiErrorResponse(error, context.requestId);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = createRequestContext(request);

  try {
    const environment = loadEnvironment(process.env);
    assertSameOrigin(request, environment.appOrigin);

    if (context.sessionToken === null) {
      return mapApiErrorResponse(
        new (await import('@/modules/identity/public')).IdentityError(
          'unauthorized',
        ),
        context.requestId,
      );
    }

    const identityService = await composeIdentityService();
    const merchant = await identityService.requireMerchant(
      context.sessionToken,
    );

    const input = createOrderInputSchema.parse(await readJson(request));

    const ordersService = await composeOrdersService();
    const order = await ordersService.createOrder(merchant, input);

    return dataResponse({ order }, 201);
  } catch (error: unknown) {
    return mapOrdersApiErrorResponse(error, context.requestId);
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}
```

Note: The `mapOrdersApiErrorResponse` function delegates to `mapErrorResponse` for non-OrderError errors (including `IdentityError`), so identity errors from `requireMerchant` will be caught by the generic path. But to be safe and consistent with auth routes, we should also check for `IdentityError` there. Update the error mapper to also handle `IdentityError`:

Actually, the cleaner approach is to update `mapOrdersApiErrorResponse` to also delegate identity errors to the identity mapper:

```typescript
// src/app/composition/orders-api-errors.ts — update the import and function:
import { IdentityError } from '@/modules/identity/public';
import { mapApiErrorResponse } from '@/app/composition/api-errors';
// ... in the function body:
export function mapOrdersApiErrorResponse(
  error: unknown,
  requestId: string,
): NextResponse {
  if (error instanceof OrderError) {
    return errorResponse({
      status: orderErrorStatus[error.code],
      requestId,
      code: orderErrorCode[error.code],
      message: orderErrorMessage[error.code],
    });
  }

  return mapApiErrorResponse(error, requestId);
}
```

This way `IdentityError` flows to `mapApiErrorResponse`, which handles it, while `OrderError` is handled locally.

Apply this update to `src/app/composition/orders-api-errors.ts`:

```typescript
import { OrderError, type OrderErrorCode } from '@/modules/orders/public';
import { errorResponse, mapErrorResponse } from '@/shared/http/api-response';
import { mapApiErrorResponse } from '@/app/composition/api-errors';
import type { NextResponse } from 'next/server';

const orderErrorStatus: Record<OrderErrorCode, number> = {
  not_found: 404,
  payment_locked: 409,
  validation_failed: 400,
};

const orderErrorCode: Record<OrderErrorCode, string> = {
  not_found: 'NOT_FOUND',
  payment_locked: 'PAYMENT_LOCKED',
  validation_failed: 'VALIDATION_ERROR',
};

const orderErrorMessage: Record<OrderErrorCode, string> = {
  not_found: 'The requested order was not found.',
  payment_locked:
    'This order has payments recorded and cannot be modified or deleted.',
  validation_failed: 'The request contained invalid data.',
};

export function mapOrdersApiErrorResponse(
  error: unknown,
  requestId: string,
): NextResponse {
  if (error instanceof OrderError) {
    return errorResponse({
      status: orderErrorStatus[error.code],
      requestId,
      code: orderErrorCode[error.code],
      message: orderErrorMessage[error.code],
    });
  }

  return mapApiErrorResponse(error, requestId);
}
```

And simplify the route handler to not do the inline identity error check (just let `requireMerchant` throw and the mapper handle it):

```typescript
// src/app/api/v1/orders/route.ts — full final version:

import { type NextRequest, NextResponse } from 'next/server';

import { composeIdentityService } from '@/modules/identity/public';
import { composeOrdersService } from '@/modules/orders/public';
import {
  createOrderInputSchema,
  listOrdersQuerySchema,
} from '@/modules/orders/public';
import { dataResponse, InvalidJsonError } from '@/shared/http/api-response';
import { mapOrdersApiErrorResponse } from '@/app/composition/orders-api-errors';
import { createRequestContext } from '@/shared/http/request-context';
import { loadEnvironment } from '@/shared/config/environment';
import { assertSameOrigin } from '@/shared/http/same-origin';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const context = createRequestContext(request);

  try {
    const identityService = await composeIdentityService();
    const merchant = await identityService.requireMerchant(
      context.sessionToken ?? '',
    );

    const query = listOrdersQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const ordersService = await composeOrdersService();
    const orders = await ordersService.listOrders(merchant, query);

    return dataResponse({ orders });
  } catch (error: unknown) {
    return mapOrdersApiErrorResponse(error, context.requestId);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const context = createRequestContext(request);

  try {
    const environment = loadEnvironment(process.env);
    assertSameOrigin(request, environment.appOrigin);

    const identityService = await composeIdentityService();
    const merchant = await identityService.requireMerchant(
      context.sessionToken ?? '',
    );

    const input = createOrderInputSchema.parse(await readJson(request));

    const ordersService = await composeOrdersService();
    const order = await ordersService.createOrder(merchant, input);

    return dataResponse({ order }, 201);
  } catch (error: unknown) {
    return mapOrdersApiErrorResponse(error, context.requestId);
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}
```

Write the final version of both files using the code above. The `requireMerchant` call with `context.sessionToken ?? ''` will throw `IdentityError('unauthorized')` when there is no session token, which `mapOrdersApiErrorResponse` will delegate to `mapApiErrorResponse` which handles identity errors correctly.

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/composition/orders-api-errors.ts src/app/api/v1/orders/route.ts
git commit -m "feat: add orders collection route handlers"
```

---

## Task 16: Orders — HTTP route handlers (detail)

**Files:**

- Create: `src/app/api/v1/orders/[id]/route.ts`

- [ ] **Step 1: Create the detail route handler**

Create `src/app/api/v1/orders/[id]/route.ts`:

```typescript
import { type NextRequest, NextResponse } from 'next/server';

import { composeIdentityService } from '@/modules/identity/public';
import { composeOrdersService } from '@/modules/orders/public';
import { updateOrderInputSchema } from '@/modules/orders/public';
import {
  dataResponse,
  InvalidJsonError,
  noContentResponse,
} from '@/shared/http/api-response';
import { mapOrdersApiErrorResponse } from '@/app/composition/orders-api-errors';
import { createRequestContext } from '@/shared/http/request-context';
import { loadEnvironment } from '@/shared/config/environment';
import { assertSameOrigin } from '@/shared/http/same-origin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const context = createRequestContext(request);
  const { id } = await params;

  try {
    const identityService = await composeIdentityService();
    const merchant = await identityService.requireMerchant(
      context.sessionToken ?? '',
    );

    const ordersService = await composeOrdersService();
    const order = await ordersService.getOrder(merchant, id);

    return dataResponse({ order });
  } catch (error: unknown) {
    return mapOrdersApiErrorResponse(error, context.requestId);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const context = createRequestContext(request);
  const { id } = await params;

  try {
    const environment = loadEnvironment(process.env);
    assertSameOrigin(request, environment.appOrigin);

    const identityService = await composeIdentityService();
    const merchant = await identityService.requireMerchant(
      context.sessionToken ?? '',
    );

    const input = updateOrderInputSchema.parse(await readJson(request));

    const ordersService = await composeOrdersService();
    const order = await ordersService.updateOrder(merchant, id, input);

    return dataResponse({ order });
  } catch (error: unknown) {
    return mapOrdersApiErrorResponse(error, context.requestId);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const context = createRequestContext(request);
  const { id } = await params;

  try {
    const environment = loadEnvironment(process.env);
    assertSameOrigin(request, environment.appOrigin);

    const identityService = await composeIdentityService();
    const merchant = await identityService.requireMerchant(
      context.sessionToken ?? '',
    );

    const ordersService = await composeOrdersService();
    await ordersService.deleteOrder(merchant, id);

    return noContentResponse();
  } catch (error: unknown) {
    return mapOrdersApiErrorResponse(error, context.requestId);
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/orders/\[id\]/route.ts
git commit -m "feat: add orders detail route handlers"
```

---

## Task 17: Orders — API contract tests

**Files:**

- Create: `tests/api/orders.test.ts`

- [ ] **Step 1: Write API contract tests**

Create `tests/api/orders.test.ts`:

```typescript
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { MongoClient, type Db } from 'mongodb';
import { NextRequest } from 'next/server';

import { POST as signUp } from '@/app/api/v1/auth/sign-up/route';
import { GET as listOrders, POST as createOrder } from '@/app/api/v1/orders/route';
import {
  GET as getOrder,
  PATCH as updateOrder,
  DELETE as deleteOrder,
} from '@/app/api/v1/orders/[id]/route';
import { resolveMongoClientOptions } from '@/shared/mongodb/client';

const mongodbUri = 'mongodb://localhost:27018/?replicaSet=rs0';
const databaseName = `crossval_orders_api_${randomUUID()}`;
const appOrigin = 'http://localhost:3000';

describe('orders API', () => {
  let client: MongoClient;
  let database: Db;
  let sessionCookie: string;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      MONGODB_URI: mongodbUri,
      MONGODB_DB_NAME: databaseName,
      APP_ORIGIN: appOrigin,
      SESSION_TTL_DAYS: '7',
      BCRYPT_COST: '12',
      BCRYPT_DUMMY_HASH:
        '$2b$12$6pXXnmXUHS4PXpEO6JeKFuq/7/7myFbHw9ZouzgxJK1YLAUNhx4wa',
    });

    client = await MongoClient.connect(
      mongodbUri,
      resolveMongoClientOptions(mongodbUri),
    );
    database = client.db(databaseName);
  });

  beforeEach(async () => {
    await database.dropDatabase();
  });

  afterAll(async () => {
    await database.dropDatabase();
    await client.close();
  });

  async function authenticate(): Promise<void> {
    await signUp(
      jsonRequest('POST', '/api/v1/auth/sign-up', {
        email: `merchant-${randomUUID()}@example.com`,
        password: 'correcthorse1',
      }),
    );

    const loginResponse = await signUp(
      jsonRequest('POST', '/api/v1/auth/sign-up', {
        email: `merchant2-${randomUUID()}@example.com`,
        password: 'correcthorse1',
      }),
    );
    sessionCookie = loginResponse.headers.get('set-cookie') ?? '';
  }
```

Note: The test file is large — continue with the remaining test cases. Each test creates an order and then exercises the API.

Actually, we need a cleaner auth helper. Let me write the complete test file:

- [ ] **Step 2: Write the complete test file**

Write the full `tests/api/orders.test.ts`:

```typescript
import { randomUUID } from 'node:crypto';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { MongoClient, type Db } from 'mongodb';
import { NextRequest } from 'next/server';

import { POST as signUp } from '@/app/api/v1/auth/sign-up/route';
import {
  GET as listOrders,
  POST as createOrder,
} from '@/app/api/v1/orders/route';
import {
  GET as getOrder,
  PATCH as updateOrder,
  DELETE as deleteOrder,
} from '@/app/api/v1/orders/[id]/route';
import { resolveMongoClientOptions } from '@/shared/mongodb/client';

const mongodbUri = 'mongodb://localhost:27018/?replicaSet=rs0';
const databaseName = `crossval_orders_api_${randomUUID()}`;
const appOrigin = 'http://localhost:3000';

describe('orders API', () => {
  let client: MongoClient;
  let database: Db;
  let sessionCookie: string;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      MONGODB_URI: mongodbUri,
      MONGODB_DB_NAME: databaseName,
      APP_ORIGIN: appOrigin,
      SESSION_TTL_DAYS: '7',
      BCRYPT_COST: '12',
      BCRYPT_DUMMY_HASH:
        '$2b$12$6pXXnmXUHS4PXpEO6JeKFuq/7/7myFbHw9ZouzgxJK1YLAUNhx4wa',
    });

    client = await MongoClient.connect(
      mongodbUri,
      resolveMongoClientOptions(mongodbUri),
    );
    database = client.db(databaseName);
  });

  beforeEach(async () => {
    await database.dropDatabase();
    sessionCookie = await createSession();
  });

  afterAll(async () => {
    await database.dropDatabase();
    await client.close();
  });

  async function createSession(): Promise<string> {
    const response = await signUp(
      jsonRequest('POST', '/api/v1/auth/sign-up', {
        email: `merchant-${randomUUID()}@example.com`,
        password: 'correcthorse1',
      }),
    );
    return response.headers.get('set-cookie') ?? '';
  }

  async function createTestOrder(): Promise<string> {
    const response = await createOrder(
      authedRequest('POST', '/api/v1/orders', {
        customer: 'Acme Corp',
        dueDate: '2026-08-15',
        lineItems: [
          { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
        ],
      }),
    );
    const body = (await response.json()) as { data: { order: { id: string } } };
    return body.data.order.id;
  }

  test('POST /api/v1/orders creates an order with server-computed totals', async () => {
    const response = await createOrder(
      authedRequest('POST', '/api/v1/orders', {
        customer: 'Acme Corp',
        dueDate: '2026-08-15',
        lineItems: [
          { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
        ],
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      data: { order: { totalMinor: number; status: string } };
    };
    expect(body.data.order.totalMinor).toBe(100000);
    expect(body.data.order.status).toBe('pending');
  });

  test("GET /api/v1/orders returns the merchant's active orders", async () => {
    await createTestOrder();

    const response = await listOrders(
      authedRequest('GET', '/api/v1/orders', undefined),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { orders: unknown[] };
    };
    expect(body.data.orders).toHaveLength(1);
  });

  test('GET /api/v1/orders/:id returns order detail', async () => {
    const orderId = await createTestOrder();

    const response = await getOrder(
      authedRequest('GET', `/api/v1/orders/${orderId}`, undefined),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { order: { id: string; lineItems: unknown[] } };
    };
    expect(body.data.order.id).toBe(orderId);
    expect(body.data.order.lineItems).toHaveLength(1);
  });

  test('GET /api/v1/orders/:id returns 404 for a non-existent order', async () => {
    const response = await getOrder(
      authedRequest('GET', '/api/v1/orders/nonexistent', undefined),
    );

    expect(response.status).toBe(404);
  });

  test('PATCH /api/v1/orders/:id updates an unlocked order', async () => {
    const orderId = await createTestOrder();

    const response = await updateOrder(
      authedRequest('PATCH', `/api/v1/orders/${orderId}`, {
        customer: 'Updated Corp',
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { order: { customer: string } };
    };
    expect(body.data.order.customer).toBe('Updated Corp');
  });

  test('DELETE /api/v1/orders/:id soft-deletes an unlocked order', async () => {
    const orderId = await createTestOrder();

    const response = await deleteOrder(
      authedRequest('DELETE', `/api/v1/orders/${orderId}`, undefined),
    );

    expect(response.status).toBe(204);

    const detailResponse = await getOrder(
      authedRequest('GET', `/api/v1/orders/${orderId}`, undefined),
    );
    expect(detailResponse.status).toBe(404);
  });

  test('unauthenticated requests return 401', async () => {
    const response = await createOrder(
      jsonRequest('POST', '/api/v1/orders', {
        customer: 'Acme Corp',
        dueDate: '2026-08-15',
        lineItems: [
          { description: 'Widget', quantity: 2, unitPriceMinor: 50000 },
        ],
      }),
    );

    expect(response.status).toBe(401);
  });
});

function authedRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): NextRequest {
  const request = jsonRequest(method, path, body);
  if (typeof sessionCookie === 'string' && sessionCookie.length > 0) {
    request.headers.set('cookie', sessionCookie);
  }
  return request;
}

function jsonRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): NextRequest {
  const headers = new Headers({
    host: 'localhost:3000',
    origin: appOrigin,
  });

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    headers.set('content-type', 'application/json');
    requestInit.body = JSON.stringify(body);
  }

  return new NextRequest(new Request(`${appOrigin}${path}`, requestInit));
}
```

Note: The `authedRequest` function references `sessionCookie` from the outer scope. Since `sessionCookie` is set in `beforeEach`, and each test calls `authedRequest` after setup, this works correctly.

- [ ] **Step 3: Run API tests (requires Docker MongoDB)**

Run: `npx vitest run tests/api/orders.test.ts`
Expected: PASS — all 7 tests pass

- [ ] **Step 4: Commit**

```bash
git add tests/api/orders.test.ts
git commit -m "test: add orders API contract tests"
```

---

## Task 18: Final verification and formatting

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (identity + order-status + orders)

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run lint on new files**

Run: `npx eslint src/modules/orders/ src/modules/order-status/ src/app/api/v1/orders/ src/app/composition/orders-api-errors.ts tests/api/orders.test.ts tests/integration/orders/`
Expected: PASS

- [ ] **Step 4: Run format check**

Run: `npx prettier --check src/modules/orders/ src/modules/order-status/ src/app/api/v1/orders/ src/app/composition/orders-api-errors.ts tests/api/orders.test.ts tests/integration/orders/`
Expected: PASS (run `prettier --write` if any files need formatting)

- [ ] **Step 5: Commit any formatting fixes**

```bash
git add -A
git commit -m "chore: format and verify orders module"
```

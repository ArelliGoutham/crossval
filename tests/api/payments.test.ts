import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { MongoClient, type Db } from 'mongodb';
import { NextRequest } from 'next/server';

import { POST as signUp } from '@/app/api/v1/auth/sign-up/route';
import { POST as createOrder } from '@/app/api/v1/orders/route';
import {
  GET as listPayments,
  POST as recordPayment,
} from '@/app/api/v1/orders/[id]/payments/route';
import { resolveMongoClientOptions } from '@/shared/mongodb/client';

const mongodbUri = 'mongodb://localhost:27018/?replicaSet=rs0';
const databaseName = `crossval_payments_api_${randomUUID()}`;
const appOrigin = 'http://localhost:3000';

describe('payments API', () => {
  let client: MongoClient;
  let database: Db;
  let sessionCookie: string;
  let orderId: string;

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
    orderId = await createTestOrder();
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

  test('POST records a payment with 201', async () => {
    const response = await recordPayment(
      authedRequest(
        'POST',
        `/api/v1/orders/${orderId}/payments`,
        { amountMinor: 40000, paymentDate: '2026-08-08' },
        { 'idempotency-key': 'key-1' },
      ),
      { params: Promise.resolve({ id: orderId }) },
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      data: { payment: { amountMinor: number; statusAfter: string } };
    };
    expect(body.data.payment.amountMinor).toBe(40000);
    expect(body.data.payment.statusAfter).toBe('partially_paid');
  });

  test('GET returns payment history', async () => {
    await recordPayment(
      authedRequest(
        'POST',
        `/api/v1/orders/${orderId}/payments`,
        { amountMinor: 40000, paymentDate: '2026-08-08' },
        { 'idempotency-key': 'key-1' },
      ),
      { params: Promise.resolve({ id: orderId }) },
    );

    const response = await listPayments(
      authedRequest('GET', `/api/v1/orders/${orderId}/payments`, undefined),
      { params: Promise.resolve({ id: orderId }) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { payments: unknown[] };
    };
    expect(body.data.payments).toHaveLength(1);
  });

  test('over-payment returns 422 with maximum allowed', async () => {
    await recordPayment(
      authedRequest(
        'POST',
        `/api/v1/orders/${orderId}/payments`,
        { amountMinor: 100000, paymentDate: '2026-08-08' },
        { 'idempotency-key': 'key-1' },
      ),
      { params: Promise.resolve({ id: orderId }) },
    );

    const response = await recordPayment(
      authedRequest(
        'POST',
        `/api/v1/orders/${orderId}/payments`,
        { amountMinor: 100, paymentDate: '2026-08-08' },
        { 'idempotency-key': 'key-2' },
      ),
      { params: Promise.resolve({ id: orderId }) },
    );

    expect(response.status).toBe(422);
    const body = (await response.json()) as {
      error: { code: string; details: { maximumAllowedAmountMinor: number } };
    };
    expect(body.error.code).toBe('OVERPAYMENT');
    expect(body.error.details.maximumAllowedAmountMinor).toBe(0);
  });

  test('idempotent replay returns 200 with original result', async () => {
    const first = await recordPayment(
      authedRequest(
        'POST',
        `/api/v1/orders/${orderId}/payments`,
        { amountMinor: 40000, paymentDate: '2026-08-08' },
        { 'idempotency-key': 'key-1' },
      ),
      { params: Promise.resolve({ id: orderId }) },
    );
    expect(first.status).toBe(201);

    const second = await recordPayment(
      authedRequest(
        'POST',
        `/api/v1/orders/${orderId}/payments`,
        { amountMinor: 40000, paymentDate: '2026-08-08' },
        { 'idempotency-key': 'key-1' },
      ),
      { params: Promise.resolve({ id: orderId }) },
    );
    expect(second.status).toBe(200);
  });

  test('missing idempotency key returns 400', async () => {
    const response = await recordPayment(
      authedRequest(
        'POST',
        `/api/v1/orders/${orderId}/payments`,
        { amountMinor: 40000, paymentDate: '2026-08-08' },
      ),
      { params: Promise.resolve({ id: orderId }) },
    );

    expect(response.status).toBe(400);
  });

  test('unauthenticated request returns 401', async () => {
    const response = await recordPayment(
      jsonRequest(
        'POST',
        `/api/v1/orders/${orderId}/payments`,
        { amountMinor: 40000, paymentDate: '2026-08-08' },
        { 'idempotency-key': 'key-1' },
      ),
      { params: Promise.resolve({ id: orderId }) },
    );

    expect(response.status).toBe(401);
  });

  function authedRequest(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): NextRequest {
    const headers: Record<string, string> = {
      host: 'localhost:3000',
      origin: appOrigin,
    };
    if (sessionCookie.length > 0) {
      headers['cookie'] = sessionCookie;
    }
    if (extraHeaders) {
      Object.assign(headers, extraHeaders);
    }

    const requestInit: RequestInit = {
      method,
      headers: new Headers(headers),
    };

    if (body !== undefined) {
      (requestInit.headers as Headers).set('content-type', 'application/json');
      requestInit.body = JSON.stringify(body);
    }

    return new NextRequest(new Request(`${appOrigin}${path}`, requestInit));
  }

  function jsonRequest(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): NextRequest {
    const headers: Record<string, string> = {
      host: 'localhost:3000',
      origin: appOrigin,
    };
    if (extraHeaders) {
      Object.assign(headers, extraHeaders);
    }

    const requestInit: RequestInit = {
      method,
      headers: new Headers(headers),
    };

    if (body !== undefined) {
      (requestInit.headers as Headers).set('content-type', 'application/json');
      requestInit.body = JSON.stringify(body);
    }

    return new NextRequest(new Request(`${appOrigin}${path}`, requestInit));
  }
});

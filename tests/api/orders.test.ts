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

  test('GET /api/v1/orders returns the merchant\'s active orders', async () => {
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
      { params: Promise.resolve({ id: orderId }) },
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
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );

    expect(response.status).toBe(404);
  });

  test('PATCH /api/v1/orders/:id updates an unlocked order', async () => {
    const orderId = await createTestOrder();

    const response = await updateOrder(
      authedRequest('PATCH', `/api/v1/orders/${orderId}`, {
        customer: 'Updated Corp',
      }),
      { params: Promise.resolve({ id: orderId }) },
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
      { params: Promise.resolve({ id: orderId }) },
    );

    expect(response.status).toBe(204);

    const detailResponse = await getOrder(
      authedRequest('GET', `/api/v1/orders/${orderId}`, undefined),
      { params: Promise.resolve({ id: orderId }) },
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

  function authedRequest(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
  ): NextRequest {
    return jsonRequest(method, path, body, sessionCookie);
  }

  function jsonRequest(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
    cookie?: string,
  ): NextRequest {
    const headers = new Headers({
      host: 'localhost:3000',
      origin: appOrigin,
    });

    if (cookie !== undefined && cookie.length > 0) {
      headers.set('cookie', cookie);
    }

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
});

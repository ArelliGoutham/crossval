import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { MongoClient, type Db } from 'mongodb';
import { NextRequest } from 'next/server';

import { POST as login } from '@/app/api/v1/auth/login/route';
import { GET as me } from '@/app/api/v1/auth/me/route';
import { POST as logout } from '@/app/api/v1/auth/logout/route';
import { POST as signUp } from '@/app/api/v1/auth/sign-up/route';
import { resolveMongoClientOptions } from '@/shared/mongodb/client';

const mongodbUri = 'mongodb://localhost:27018/?replicaSet=rs0';
const databaseName = `crossval_task_6_${randomUUID()}`;
const appOrigin = 'http://localhost:3000';

describe('authentication API', () => {
  let client: MongoClient;
  let database: Db;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      MONGODB_URI: mongodbUri,
      MONGODB_DB_NAME: databaseName,
      APP_ORIGIN: appOrigin,
      SESSION_TTL_DAYS: '7',
      BCRYPT_COST: '12',
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

  test('sign-up returns 201 with an HttpOnly SameSite=Lax session cookie', async () => {
    const response = await signUp(
      request('POST', '/api/v1/auth/sign-up', {
        email: 'merchant@example.com',
        password: 'correcthorse1',
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax');
    expect(await response.json()).toEqual({
      data: {
        user: expect.objectContaining({
          email: 'merchant@example.com',
        }),
      },
    });
  });

  test('login does not reveal whether an email exists', async () => {
    const missingUserResponse = await login(
      request('POST', '/api/v1/auth/login', {
        email: 'missing@example.com',
        password: 'correcthorse1',
      }),
    );

    await signUp(
      request('POST', '/api/v1/auth/sign-up', {
        email: 'merchant@example.com',
        password: 'correcthorse1',
      }),
    );

    const wrongPasswordResponse = await login(
      request('POST', '/api/v1/auth/login', {
        email: 'merchant@example.com',
        password: 'wrongpassword',
      }),
    );

    await expect(asJson(missingUserResponse)).resolves.toMatchObject({
      status: 401,
      body: {
        error: {
          code: 'INVALID_CREDENTIALS',
        },
      },
    });
    await expect(asJson(wrongPasswordResponse)).resolves.toMatchObject({
      status: 401,
      body: {
        error: {
          code: 'INVALID_CREDENTIALS',
        },
      },
    });
  });

  test('logout rejects unsafe requests with a foreign Origin header', async () => {
    const response = await logout(
      request('POST', '/api/v1/auth/logout', undefined, {
        origin: 'https://attacker.example',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'INVALID_ORIGIN',
      },
    });
  });

  test('me returns only the authenticated identity from the session cookie', async () => {
    const signUpResponse = await signUp(
      request('POST', '/api/v1/auth/sign-up', {
        email: 'merchant@example.com',
        password: 'correcthorse1',
      }),
    );
    const sessionCookie = signUpResponse.headers.get('set-cookie');

    expect(sessionCookie).not.toBeNull();

    const response = await me(
      request('GET', '/api/v1/auth/me', undefined, {
        cookie: sessionCookie ?? undefined,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        identity: {
          userId: expect.any(String),
          merchantId: expect.any(String),
        },
      },
    });
  });

  test('logout clears the session cookie and leaves me unauthorized afterwards', async () => {
    const signUpResponse = await signUp(
      request('POST', '/api/v1/auth/sign-up', {
        email: 'merchant@example.com',
        password: 'correcthorse1',
      }),
    );
    const sessionCookie = signUpResponse.headers.get('set-cookie');

    expect(sessionCookie).not.toBeNull();

    const logoutResponse = await logout(
      request('POST', '/api/v1/auth/logout', undefined, {
        cookie: sessionCookie ?? undefined,
      }),
    );

    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.headers.get('set-cookie')).toContain('Expires=');

    const meResponse = await me(
      request('GET', '/api/v1/auth/me', undefined, {
        cookie: sessionCookie ?? undefined,
      }),
    );

    expect(meResponse.status).toBe(401);
    await expect(meResponse.json()).resolves.toMatchObject({
      error: {
        code: 'UNAUTHORIZED',
      },
    });
  });
});

function request(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, string>,
  extraHeaders?: Record<string, string | undefined>,
): NextRequest {
  const headers = new Headers({
    host: 'localhost:3000',
    ...extraHeaders,
  });
  if (method === 'POST' && !headers.has('origin')) {
    headers.set('origin', appOrigin);
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

async function asJson(response: Response): Promise<{
  status: number;
  body: unknown;
}> {
  return {
    status: response.status,
    body: await response.json(),
  };
}

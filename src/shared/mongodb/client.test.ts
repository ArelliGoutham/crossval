import { describe, expect, test } from 'vitest';

import { resolveMongoClientOptions } from '@/shared/mongodb/client';

describe('resolveMongoClientOptions', () => {
  test('uses a direct connection for the documented local Docker host URI', () => {
    expect(
      resolveMongoClientOptions('mongodb://localhost:27018/?replicaSet=rs0'),
    ).toEqual({
      directConnection: true,
    });
  });

  test('uses normal replica-set discovery for non-local MongoDB URIs', () => {
    expect(
      resolveMongoClientOptions(
        'mongodb+srv://user:password@cluster0.example.mongodb.net/crossval',
      ),
    ).toEqual({});
  });
});

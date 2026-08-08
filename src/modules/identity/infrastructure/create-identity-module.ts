import { IdentityService } from '@/modules/identity/application/identity-service';
import { BcryptPasswordHasher } from '@/modules/identity/infrastructure/bcrypt-password-hasher';
import { CryptoIdGenerator } from '@/modules/identity/infrastructure/crypto-id-generator';
import { CryptoSessionTokenGenerator } from '@/modules/identity/infrastructure/crypto-session-token-generator';
import { ensureIdentityIndexes } from '@/modules/identity/infrastructure/ensure-indexes';
import { MongoIdentityTransactionRunner } from '@/modules/identity/infrastructure/mongo-identity-transaction-runner';
import { MongoSessionRepository } from '@/modules/identity/infrastructure/mongo-session-repository';
import { MongoUserRepository } from '@/modules/identity/infrastructure/mongo-user-repository';
import { SystemClock } from '@/modules/identity/infrastructure/system-clock';
import { loadEnvironment } from '@/shared/config/environment';
import { getMongoClient } from '@/shared/mongodb/client';

let identityModulePromise: Promise<IdentityService> | undefined;

export function createIdentityModule(): Promise<IdentityService> {
  identityModulePromise ??= createIdentityModuleInternal();

  return identityModulePromise;
}

async function createIdentityModuleInternal(): Promise<IdentityService> {
  const environment = loadEnvironment(process.env);
  const client = await getMongoClient();
  const database = client.db(environment.mongodbDatabaseName);

  await ensureIdentityIndexes(database);

  return new IdentityService({
    users: new MongoUserRepository(database),
    sessions: new MongoSessionRepository(database),
    hasher: new BcryptPasswordHasher(environment.bcryptCost),
    tokens: new CryptoSessionTokenGenerator(),
    ids: new CryptoIdGenerator(),
    clock: new SystemClock(),
    transactions: new MongoIdentityTransactionRunner(client, database),
    dummyPasswordHash: environment.bcryptDummyHash,
  });
}

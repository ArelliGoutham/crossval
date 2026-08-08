import { MongoClient, type MongoClientOptions } from 'mongodb';

import { loadEnvironment } from '@/shared/config/environment';

let mongoClientPromise: Promise<MongoClient> | undefined;

export function resolveMongoClientOptions(
  mongodbUri: string,
): MongoClientOptions {
  if (mongodbUri === 'mongodb://localhost:27018/?replicaSet=rs0') {
    return {
      directConnection: true,
    };
  }

  return {};
}

export function getMongoClient(): Promise<MongoClient> {
  const { mongodbUri } = loadEnvironment(process.env);

  mongoClientPromise ??= MongoClient.connect(
    mongodbUri,
    resolveMongoClientOptions(mongodbUri),
  );

  return mongoClientPromise;
}

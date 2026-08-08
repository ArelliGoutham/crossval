import { MongoClient } from 'mongodb';

import { loadEnvironment } from '@/shared/config/environment';

let mongoClientPromise: Promise<MongoClient> | undefined;

export function getMongoClient(): Promise<MongoClient> {
  const { mongodbUri } = loadEnvironment(process.env);

  mongoClientPromise ??= MongoClient.connect(mongodbUri, {
    directConnection: true,
  });

  return mongoClientPromise;
}

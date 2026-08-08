import { z } from 'zod';

const environmentSchema = z
  .object({
    MONGODB_URI: z.url(),
    MONGODB_DB_NAME: z.string().trim().min(1),
    APP_ORIGIN: z.url(),
    SESSION_TTL_DAYS: z.coerce.number().int().positive(),
    BCRYPT_COST: z.coerce.number().int().min(12),
  })
  .transform((environment) => ({
    mongodbUri: environment.MONGODB_URI,
    mongodbDatabaseName: environment.MONGODB_DB_NAME,
    appOrigin: environment.APP_ORIGIN,
    sessionTtlDays: environment.SESSION_TTL_DAYS,
    bcryptCost: environment.BCRYPT_COST,
  }));

export type AppEnvironment = Readonly<z.output<typeof environmentSchema>>;

export function loadEnvironment(input: NodeJS.ProcessEnv): AppEnvironment {
  return Object.freeze(environmentSchema.parse(input));
}

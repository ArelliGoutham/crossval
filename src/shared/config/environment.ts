import { z } from 'zod';

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .optional()
      .default('development'),
    MONGODB_URI: z.url(),
    MONGODB_DB_NAME: z.string().trim().min(1),
    APP_ORIGIN: z.url(),
    SESSION_TTL_DAYS: z.coerce
      .number()
      .int()
      .refine((value) => value === 7, {
        message: 'SESSION_TTL_DAYS must be exactly 7',
      }),
    BCRYPT_COST: z.coerce.number().int().min(12),
    BCRYPT_DUMMY_HASH: z.string().regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/),
  })
  .superRefine((environment, context) => {
    const dummyHashCost = Number.parseInt(
      environment.BCRYPT_DUMMY_HASH.slice(4, 6),
      10,
    );

    if (dummyHashCost !== environment.BCRYPT_COST) {
      context.addIssue({
        code: 'custom',
        path: ['BCRYPT_DUMMY_HASH'],
        message: 'BCRYPT_DUMMY_HASH must use the configured BCRYPT_COST',
      });
    }
  })
  .transform((environment) => ({
    mongodbUri: environment.MONGODB_URI,
    mongodbDatabaseName: environment.MONGODB_DB_NAME,
    appOrigin: environment.APP_ORIGIN,
    isProduction: environment.NODE_ENV === 'production',
    sessionTtlDays: environment.SESSION_TTL_DAYS,
    bcryptCost: environment.BCRYPT_COST,
    bcryptDummyHash: environment.BCRYPT_DUMMY_HASH,
  }));

export type AppEnvironment = Readonly<z.output<typeof environmentSchema>>;

export function loadEnvironment(input: NodeJS.ProcessEnv): AppEnvironment {
  return Object.freeze(environmentSchema.parse(input));
}

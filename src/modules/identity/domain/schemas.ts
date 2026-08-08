import { z } from 'zod';

const normalizedEmailSchema = z
  .email()
  .transform((email) => email.trim().toLowerCase());
const passwordSchema = z.string().min(12);

const credentialsSchema = z.object({
  email: z.string().trim().pipe(normalizedEmailSchema),
  password: passwordSchema,
});

export const signUpInputSchema = credentialsSchema;
export const loginInputSchema = credentialsSchema;

export type SignUpInput = z.infer<typeof signUpInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;

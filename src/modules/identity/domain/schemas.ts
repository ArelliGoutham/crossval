import { z } from 'zod';

const normalizedEmailSchema = z
  .email('Enter a valid email address.')
  .transform((email) => email.trim().toLowerCase());
const passwordSchema = z
  .string()
  .min(12, 'Password must contain at least 12 characters.');

const credentialsSchema = z.object({
  email: z.string().trim().pipe(normalizedEmailSchema),
  password: passwordSchema,
});

export const signUpInputSchema = credentialsSchema;
export const loginInputSchema = credentialsSchema;

export type SignUpInput = z.infer<typeof signUpInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;

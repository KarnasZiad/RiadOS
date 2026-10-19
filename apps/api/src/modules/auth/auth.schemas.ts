import { z } from 'zod';

const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const RegisterSchema = z.object({
  propertyName: z.string().trim().min(2).max(120),
  fullName: z.string().trim().min(2).max(120),
  email: EmailSchema,
  // NIST SP 800-63B: length rather than composition rules. The upper bound protects the hasher.
  password: z.string().min(12).max(128),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof LoginSchema>;

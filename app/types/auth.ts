// Shared Zod schemas & TS types for the authentication pages (login,
// register, verify-email, reset-password). Kept beside the DB-facing schemas
// (./records.ts) so every form validates against a single source of truth.
//
// UI-level constraints mirror the product rules: password must be 8+
// characters and contain at least one number.

import { z } from 'zod'

// Pragmatic email check — the same shape browsers use for input[type=email].
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const EmailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(254, 'Email must be at most 254 characters')
  .regex(EMAIL_REGEX, 'Enter a valid email address')

// Product rule (see product-design.md §6.1): at least 8 characters and one number.
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/\d/, 'Password must include at least one number')

const ConfirmPasswordSchema = z.string().min(1, 'Please confirm your password')

export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
})

export const RegisterInputSchema = z
  .object({
    email: EmailSchema,
    password: PasswordSchema,
    confirmPassword: ConfirmPasswordSchema,
  })
  .refine(value => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export const ResetRequestSchema = z.object({
  email: EmailSchema,
})

export const NewPasswordSchema = z
  .object({
    password: PasswordSchema,
    confirmPassword: ConfirmPasswordSchema,
  })
  .refine(value => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export type LoginInput = z.infer<typeof LoginInputSchema>
export type RegisterInput = z.infer<typeof RegisterInputSchema>
export type ResetRequest = z.infer<typeof ResetRequestSchema>
export type NewPassword = z.infer<typeof NewPasswordSchema>

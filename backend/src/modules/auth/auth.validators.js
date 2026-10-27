import { z } from 'zod';

export const loginSchema = {
  body: z.object({
    identifier: z.string().trim().min(1, 'Username, email or phone is required'),
    password: z.string().min(1, 'Password is required')
  })
};

export const changePasswordSchema = {
  body: z.object({
    // Optional only for first-login accounts; the service enforces it otherwise
    currentPassword: z.string().optional().nullable(),
    newPassword: z
      .string()
      .min(10, 'New password must be at least 10 characters long')
      .max(128, 'New password must not exceed 128 characters')
  })
};

export const forgotPasswordSchema = {
  body: z.object({
    identifier: z.string().trim().min(1, 'Identifier is required')
  })
};

export const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z
      .string()
      .min(10, 'Password must be at least 10 characters long')
      .max(128, 'Password must not exceed 128 characters')
  })
};

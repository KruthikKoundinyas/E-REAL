const { z } = require('zod');

const registerSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be 255 characters or fewer'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer'),
});

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

module.exports = { registerSchema, loginSchema };

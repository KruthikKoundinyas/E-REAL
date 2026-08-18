const { z } = require('zod');

const scheduleEmailSchema = z.object({
  recipient: z
    .string({ required_error: 'Recipient is required' })
    .trim()
    .email('Invalid recipient email address')
    .max(255, 'Recipient must be 255 characters or fewer'),
  subject: z
    .string({ required_error: 'Subject is required' })
    .trim()
    .min(1, 'Subject cannot be empty')
    .max(500, 'Subject must be 500 characters or fewer'),
  body: z
    .string({ required_error: 'Body is required' })
    .trim()
    .min(1, 'Body cannot be empty')
    .max(50000, 'Body must be 50,000 characters or fewer'),
  scheduledAt: z
    .string({ required_error: 'Scheduled time is required' })
    .datetime({ message: 'Must be a valid ISO 8601 datetime' })
    .refine(val => new Date(val) > new Date(), {
      message: 'Scheduled time must be in the future',
    }),
});

const emailQuerySchema = z.object({
  status: z
    .enum(['scheduled', 'sent', 'failed'], { message: 'Status must be scheduled, sent, or failed' })
    .optional(),
});

module.exports = { scheduleEmailSchema, emailQuerySchema };

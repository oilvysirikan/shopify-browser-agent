import { z } from 'zod';

const settingsSchema = z.object({
  theme: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  // Add more settings as needed
}).optional();

export const updateTenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  settings: settingsSchema,
});

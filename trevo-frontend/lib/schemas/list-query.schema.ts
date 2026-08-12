import { z } from "zod";

export const listQuerySchema = z.object({
  fields: z.array(z.string()).optional(),
  filters: z.array(z.unknown()).optional(),
  order_by: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  limit_start: z.number().int().min(0).optional(),
});

export type ListQueryInput = z.infer<typeof listQuerySchema>;

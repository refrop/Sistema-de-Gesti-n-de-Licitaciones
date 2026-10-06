import { z } from "zod";

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().min(1).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export function listMeta(total: number, query: ListQuery) {
  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export function skipTake(query: ListQuery) {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

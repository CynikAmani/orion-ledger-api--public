export interface PaginatedListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function paginatedListMeta(
  page: number,
  limit: number,
  total: number,
): PaginatedListMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

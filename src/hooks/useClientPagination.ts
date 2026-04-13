import { useState, useMemo } from 'react';

interface UseClientPaginationOptions<T> {
  pageSize?: number;
  pageSizeOptions?: number[];
}

/**
 * Hook para paginación del lado del cliente con TanStack Query.
 * Se usa junto con useQuery para paginar datos ya cargados.
 */
export function useClientPagination<T>(data: T[] | undefined, options: UseClientPaginationOptions<T> = {}) {
  const { pageSize: initialPageSize = 10 } = options;

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Calcular items paginados
  const paginatedData = useMemo(() => {
    if (!data) return [];
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  const totalPages = Math.ceil((data?.length ?? 0) / pageSize);

  // Resetear página cuando cambian los datos o el pageSize
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return {
    currentPage,
    totalPages,
    pageSize,
    totalItems: data?.length ?? 0,
    paginatedData,
    setCurrentPage: handlePageChange,
    setPageSize: handlePageSizeChange,
    // Reset helper
    resetPagination: () => setCurrentPage(1),
  };
}

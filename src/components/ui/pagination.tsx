import { Button } from '@/components/ui/button';
import {ArrowLeft2, ArrowRight2,  ChevronLeft, ChevronRight, AnglesLeft, AnglesRight } from 'reicon-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

const PAGE_SIZES = [10, 25, 50, 100];

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems ?? totalPages * pageSize);

  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (currentPage <= 3) return i + 1;
    if (currentPage >= totalPages - 2) return totalPages - 4 + i;
    return currentPage - 2 + i;
  });

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-4 ${className}`}>
      {/* Info */}
      {totalItems && (
        <div className="text-sm text-muted-foreground">
          Mostrando {startItem}-{endItem} de {totalItems}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Page Size Selector */}
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} por página
              </option>
            ))}
          </select>
        )}

        {/* Pagination Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage === 1}
            onClick={() => onPageChange(1)}
          >
            <ArrowLeft2 className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {pages.map((page) => (
            <Button
              key={page}
              variant={page === currentPage ? 'default' : 'outline'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ))}

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(totalPages)}
          >
            <ArrowRight2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { paginationItems } from '@/lib/categories';
import { cn } from '@/lib/utils';

export default function CatalogPagination({ page, pageCount, onPageChange, className }) {
  const total = Math.max(1, Number(pageCount) || 1);
  const current = Math.min(Math.max(1, Number(page) || 1), total);
  if (total <= 1) return null;

  const items = paginationItems(current, total);

  return (
    <nav
      className={cn('flex flex-wrap items-center justify-center gap-1 pt-2', className)}
      aria-label="Product pagination"
    >
      <button
        type="button"
        disabled={current <= 1}
        onClick={() => onPageChange(current - 1)}
        className="inline-flex h-11 min-w-[44px] items-center justify-center gap-1 rounded-full border border-border bg-white px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </button>
      {items.map((item) => (
        typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === current ? 'page' : undefined}
            className={cn(
              'inline-flex h-11 min-w-[44px] items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors',
              item === current
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-white text-foreground hover:border-primary/40 hover:bg-secondary',
            )}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="inline-flex h-11 min-w-[44px] items-center justify-center text-sm text-muted-foreground" aria-hidden>
            ...
          </span>
        )
      ))}
      <button
        type="button"
        disabled={current >= total}
        onClick={() => onPageChange(current + 1)}
        className="inline-flex h-11 min-w-[44px] items-center justify-center gap-1 rounded-full border border-border bg-white px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

import React from 'react';
import { visibleCategoryFilters } from '@/lib/categories';
import { cn } from '@/lib/utils';

function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-11 min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-white text-foreground hover:border-primary/40 hover:bg-secondary',
      )}
    >
      {children}
    </button>
  );
}

export default function CategoryFilter({ active, onChange, counts = null }) {
  const { primary } = visibleCategoryFilters(counts);

  return (
    <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
      {primary.map((cat) => (
        <Chip
          key={cat.key}
          active={active === cat.key}
          onClick={() => onChange(active === cat.key ? '' : cat.key)}
        >
          {cat.label}
        </Chip>
      ))}
    </div>
  );
}

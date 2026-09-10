import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { visibleCategoryFilters } from '@/lib/categories';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const { primary, more } = visibleCategoryFilters(counts);
  const moreActive = more.some((item) => item.key === active);

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
      {more.length > 0 ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'hidden h-11 min-h-[44px] shrink-0 rounded-full px-4 md:inline-flex',
                  moreActive && 'border-primary bg-primary text-primary-foreground hover:bg-[hsl(var(--brand-hover))] hover:text-primary-foreground',
                )}
              >
                More
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {more.map((cat) => (
                <DropdownMenuItem key={cat.key} onClick={() => onChange(active === cat.key ? '' : cat.key)}>
                  {cat.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex gap-2 md:hidden">
            {more.map((cat) => (
              <Chip
                key={cat.key}
                active={active === cat.key}
                onClick={() => onChange(active === cat.key ? '' : cat.key)}
              >
                {cat.label}
              </Chip>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

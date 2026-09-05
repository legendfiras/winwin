import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function EmptyState({
  icon: Icon = null,
  title,
  description = '',
  actionLabel = '',
  onAction = undefined,
  to = undefined,
  className = '',
}) {
  return (
    <div className={cn('rounded-[18px] border border-border bg-white px-6 py-14 text-center shadow-subtle', className)}>
      {Icon ? <Icon className="mx-auto mb-4 h-10 w-10 text-primary" aria-hidden="true" /> : null}
      <h3 className="font-heading text-xl font-semibold text-foreground">{title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {actionLabel && to ? (
        <Button asChild className="mt-5 h-11 rounded-[10px]">
          <Link to={to} onClick={onAction}>{actionLabel}</Link>
        </Button>
      ) : null}
      {actionLabel && onAction && !to ? (
        <Button className="mt-5 h-11 rounded-[10px]" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

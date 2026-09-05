import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-subtle">
      <Skeleton className="aspect-square w-full rounded-none bg-[#F7F4F0]" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="mt-2 h-10 w-full rounded-[10px]" />
      </div>
    </div>
  );
}

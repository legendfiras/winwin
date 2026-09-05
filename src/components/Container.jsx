import React from 'react';
import { cn } from '@/lib/utils';

export default function Container({ as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag className={cn('mx-auto w-full max-w-[1320px] px-4 md:px-8', className)} {...props}>
      {children}
    </Tag>
  );
}

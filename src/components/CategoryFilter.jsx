import React from 'react';
import { Button } from '@/components/ui/button';

const CATEGORIES = [
  { key: 'all', label: 'All Items' },
  { key: 'home_appliance', label: 'Home Appliance' },
  { key: 'home_essentials', label: 'Home Essentials' },
  { key: 'phone_accessories', label: 'Phone Accessories' },
  { key: 'toys', label: 'Toys' },
  { key: 'new_gadgets', label: 'New Gadgets' },
  { key: 'must_have', label: 'Must Have' },
  { key: 'beauty_care', label: 'Beauty Care' },
  { key: 'fans', label: 'Fans' },
  { key: 'shavers', label: 'Shavers' },
  { key: 'silkapils', label: 'Silkapils' },
  { key: 'hair_care', label: 'Hair Care' },
];

export default function CategoryFilter({ active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {CATEGORIES.map(cat => (
        <Button
          key={cat.key}
          variant={active === cat.key ? 'default' : 'outline'}
          onClick={() => onChange(cat.key)}
          className="whitespace-nowrap rounded-full font-body text-sm h-11 min-h-[44px] px-4"
        >
          {cat.label}
        </Button>
      ))}
    </div>
  );
}
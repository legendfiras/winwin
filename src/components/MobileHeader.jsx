import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MobileHeader({ title, backTo, showBack = true }) {
  const navigate = useNavigate();

  return (
    <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-lg border-b border-border safe-top">
      <div className="flex items-center h-14 px-4 gap-3">
        {showBack ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 min-w-[44px] min-h-[44px] select-none"
            onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        ) : (
          <div className="h-11 w-11 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <div className="bg-primary text-primary-foreground rounded-xl p-2">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
        )}
        <h1 className="font-heading font-semibold text-lg truncate select-none">{title}</h1>
      </div>
    </header>
  );
}
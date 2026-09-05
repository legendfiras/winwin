import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CartButton from '@/components/CartButton';
import BrandLogo from '@/components/BrandLogo';

export default function MobileHeader({ title, backTo, showBack = true, showCart = true }) {
  const navigate = useNavigate();

  return (
    <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-lg border-b border-border safe-top">
      <div className="flex items-center h-14 px-4 gap-3">
        {showBack ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 min-w-[44px] min-h-[44px] select-none"
              onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-heading font-semibold text-lg truncate select-none flex-1 text-foreground">{title}</h1>
          </>
        ) : (
          <Link to="/" className="flex items-center min-w-0 flex-1">
            <BrandLogo className="h-10" />
          </Link>
        )}
        {showCart ? <CartButton /> : <div className="w-11" />}
      </div>
    </header>
  );
}

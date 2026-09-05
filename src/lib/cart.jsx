import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CART_KEY = 'winwin_cart';
const CartContext = createContext(null);

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '{"items":[]}');
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify({ items }));
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readCart);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    writeCart(items);
  }, [items]);

  const api = useMemo(() => {
    const addItem = (product, qty = 1) => {
      if (!product?.id || product.in_stock === false) return;
      const addQty = Math.max(1, Number(qty) || 1);
      setItems((current) => {
        const existing = current.find((item) => item.id === product.id);
        if (existing) {
          return current.map((item) =>
            item.id === product.id ? { ...item, qty: item.qty + addQty } : item,
          );
        }
        return [
          ...current,
          {
            id: product.id,
            name: product.name,
            price: Number(product.price) || 0,
            image_url: product.image_url || '',
            qty: addQty,
          },
        ];
      });
    };

    const setQty = (id, qty) => {
      const next = Math.max(0, Number(qty) || 0);
      setItems((current) => {
        if (next <= 0) return current.filter((item) => item.id !== id);
        return current.map((item) => (item.id === id ? { ...item, qty: next } : item));
      });
    };

    const removeItem = (id) => setItems((current) => current.filter((item) => item.id !== id));
    const clear = () => setItems([]);

    return {
      items,
      addItem,
      setQty,
      removeItem,
      clear,
      drawerOpen,
      setDrawerOpen,
      openCart: () => setDrawerOpen(true),
      closeCart: () => setDrawerOpen(false),
      checkoutOpen,
      setCheckoutOpen,
      openCheckout: () => {
        setDrawerOpen(false);
        setCheckoutOpen(true);
      },
    };
  }, [items, drawerOpen, checkoutOpen]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  const count = ctx.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const subtotal = ctx.items.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0),
    0,
  );
  return { ...ctx, count, subtotal };
}

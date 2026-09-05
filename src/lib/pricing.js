export const MEMBER_DISCOUNT = 0.15;

export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function formatMoney(value) {
  return `$${roundMoney(value).toFixed(2)}`;
}

export function memberPrice(regular) {
  return roundMoney((Number(regular) || 0) * (1 - MEMBER_DISCOUNT));
}

export function memberSavings(regular) {
  return roundMoney((Number(regular) || 0) * MEMBER_DISCOUNT);
}

export function lineTotal(price, qty) {
  return roundMoney((Number(price) || 0) * (Number(qty) || 0));
}

export function cartTotals(items, hasCard) {
  const list = Array.isArray(items) ? items : [];
  const subtotal = roundMoney(
    list.reduce((sum, item) => sum + lineTotal(item.price, item.qty), 0),
  );
  const discount = hasCard ? roundMoney(subtotal * MEMBER_DISCOUNT) : 0;
  return {
    subtotal,
    discount,
    total: roundMoney(subtotal - discount),
  };
}

export function orderDisplayId(id) {
  return `WW-${String(id || '').slice(0, 8).toUpperCase()}`;
}

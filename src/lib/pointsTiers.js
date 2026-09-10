export function pointsForPurchaseUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 15) return 0;
  if (n <= 20) return 20;
  if (n <= 40) return 35;
  if (n <= 60) return 50;
  if (n <= 100) return 75;
  return 100;
}

export function pointsPriceFromUsd(price) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

export function productPointsCost(product) {
  const stored = Number(product?.points_price);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  return pointsPriceFromUsd(product?.price);
}

export function canRedeemProduct(product, customer) {
  const cost = productPointsCost(product);
  const points = Number(customer?.points) || 0;
  return Boolean(customer) && product?.in_stock !== false && cost > 0 && points >= cost;
}

export function pointsShortfall(product, customer) {
  const cost = productPointsCost(product);
  const points = Number(customer?.points) || 0;
  return Math.max(0, cost - points);
}

export function formatPoints(points) {
  return `${Number(points || 0).toLocaleString()} pts`;
}

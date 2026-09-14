export const POINTS_EARN_PER_USD_KEY = 'points_earn_per_usd';
export const POINTS_EARN_MIN_USD_KEY = 'points_earn_min_usd';
export const DEFAULT_POINTS_EARN_PER_USD = 1;
export const DEFAULT_POINTS_EARN_MIN_USD = 15;

export function parseEarnSettings(map = {}) {
  const rateRaw = map[POINTS_EARN_PER_USD_KEY];
  const minRaw = map[POINTS_EARN_MIN_USD_KEY];
  const rate = Number(rateRaw);
  const min = Number(minRaw);
  return {
    pointsPerUsd: Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_POINTS_EARN_PER_USD,
    minUsd: Number.isFinite(min) && min >= 0 ? min : DEFAULT_POINTS_EARN_MIN_USD,
  };
}

export function pointsForPurchaseUsd(amount, earnSettings) {
  const n = Number(amount);
  const minUsd = Number(earnSettings?.minUsd);
  const min = Number.isFinite(minUsd) && minUsd >= 0 ? minUsd : DEFAULT_POINTS_EARN_MIN_USD;
  if (!Number.isFinite(n) || n < min) return 0;
  const rate = Number(earnSettings?.pointsPerUsd);
  const perUsd = Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_POINTS_EARN_PER_USD;
  return Math.max(0, Math.round(n * perUsd));
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

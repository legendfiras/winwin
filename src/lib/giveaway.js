import { roundMoney } from './pricing.js';

export const PHONE_GIVEAWAY_CODE = 'winwin-phone';
export const PHONE_GIVEAWAY_LINE = 'winwin - phone';
export const GIVEAWAY_ENTRY_DOLLARS = 20;
export const GIVEAWAY_MINIMUM_MESSAGE = 'At least $20 in items is required to earn a phone giveaway entry.';

export function normalizeGiveawayCode(value) {
  return String(value || '').trim().toLowerCase();
}

export function isPhoneGiveawayCode(value) {
  return normalizeGiveawayCode(value) === PHONE_GIVEAWAY_CODE;
}

// Item prices after discounts. A delivery fee is never added to this amount.
export function giveawayEligibleSubtotal(amounts = {}) {
  const itemSubtotal = roundMoney(amounts.itemSubtotal);
  const discount = roundMoney(amounts.discount);
  return roundMoney(Math.max(0, itemSubtotal - discount));
}

export function giveawayEntryCount(eligibleSubtotal) {
  const cents = Math.round(roundMoney(eligibleSubtotal) * 100);
  if (!Number.isFinite(cents) || cents < GIVEAWAY_ENTRY_DOLLARS * 100) return 0;
  return Math.floor(cents / (GIVEAWAY_ENTRY_DOLLARS * 100));
}

export function giveawayCheckoutNotice(code, amounts) {
  if (!isPhoneGiveawayCode(code)) return '';
  const entries = giveawayEntryCount(giveawayEligibleSubtotal(amounts));
  if (entries > 0) return '';
  return GIVEAWAY_MINIMUM_MESSAGE;
}

import {
  giveawayEligibleSubtotal,
  giveawayEntryCount,
  isPhoneGiveawayCode,
  PHONE_GIVEAWAY_LINE,
} from './giveaway.js';
import { formatMoney, lineTotal, orderDisplayId } from './pricing.js';

export function whatsappNumber(raw) {
  return String(raw || '0096181629538').replace(/[^0-9]/g, '').replace(/^0+/, '');
}

export function whatsappUrl(rawNumber, text) {
  const number = whatsappNumber(rawNumber);
  return `https://wa.me/${number}?text=${encodeURIComponent(text || '')}`;
}

export function cartWhatsAppMessage(items, options = {}) {
  const { subtotal, discount, total, ambassadorCode, hasCard, orderId, customerName, delivery } = options;
  const lines = ['Hi WinWin 👋', ''];
  if (orderId) lines.push(`Order ${orderDisplayId(orderId)}`, '');
  if (customerName) lines.push(`Name: ${customerName}`);
  lines.push("I'd like to order:", '');
  (items || []).forEach((item) => {
    const qty = Number(item.qty) || 1;
    const unit = item.price != null ? item.price : item.unit_price;
    lines.push(`${qty}× ${item.name} — ${formatMoney(lineTotal(unit, qty))}`);
  });
  lines.push('');
  if (subtotal != null) lines.push(`Subtotal: ${formatMoney(subtotal)}`);
  if (hasCard && Number(discount) > 0) lines.push(`WinWin Discount: -${formatMoney(discount)}`);
  lines.push(`Total: ${formatMoney(total)}`);
  if (ambassadorCode) lines.push(`Ambassador code: ${ambassadorCode}`);
  if (delivery) {
    lines.push('');
    lines.push('Delivery:');
    if (delivery.governorate) lines.push(`Area: ${delivery.governorate}${delivery.area ? `, ${delivery.area}` : ''}`);
    if (delivery.street) lines.push(`Street: ${delivery.street}`);
    if (delivery.building) lines.push(`Building: ${delivery.building}`);
    if (delivery.floor) lines.push(`Floor: ${delivery.floor}`);
    if (delivery.instructions) lines.push(`Notes: ${delivery.instructions}`);
  }
  if (isPhoneGiveawayCode(options.giveawayCode)) {
    const eligible = options.eligibleSubtotal != null
      ? options.eligibleSubtotal
      : giveawayEligibleSubtotal({
        itemSubtotal: subtotal,
        discount,
        deliveryFee: options.deliveryFee,
      });
    lines.push('');
    lines.push(PHONE_GIVEAWAY_LINE);
    const entries = giveawayEntryCount(eligible);
    if (entries > 0) lines.push(`Phone giveaway entries: ${entries}`);
  }
  return lines.join('\n');
}

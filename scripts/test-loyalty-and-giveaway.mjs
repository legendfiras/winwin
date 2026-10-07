import assert from 'node:assert/strict';
import {
  giveawayCheckoutNotice,
  giveawayEligibleSubtotal,
  giveawayEntryCount,
  GIVEAWAY_MINIMUM_MESSAGE,
  isPhoneGiveawayCode,
  PHONE_GIVEAWAY_LINE,
} from '../src/lib/giveaway.js';
import { membershipExpiryDay, membershipExpiryIso } from '../src/lib/membershipTerm.js';
import { cartWhatsAppMessage, whatsappUrl } from '../src/lib/whatsapp.js';

const delivery = {
  governorate: 'Beirut',
  area: 'Hamra',
  street: 'Main',
  building: '4',
  floor: '2',
  instructions: 'Ring the bell',
};

function entries(amounts) {
  return giveawayEntryCount(giveawayEligibleSubtotal(amounts));
}

function message(extra) {
  return cartWhatsAppMessage(
    [{ name: 'Soap', qty: 1, price: extra.subtotal }],
    {
      subtotal: extra.subtotal,
      discount: extra.discount || 0,
      total: extra.subtotal,
      orderId: 'abcd1234ef',
      customerName: 'Ada',
      ambassadorCode: 'FRIEND',
      hasCard: false,
      delivery,
      giveawayCode: extra.giveawayCode,
      eligibleSubtotal: giveawayEligibleSubtotal({
        itemSubtotal: extra.subtotal,
        discount: extra.discount || 0,
        deliveryFee: extra.deliveryFee || 0,
      }),
    },
  );
}

const cases = [
  ['2026-01-15T10:00:00.000Z', '2026-02-14'],
  ['2026-01-31T23:30:00.000Z', '2026-03-02'],
  ['2026-12-15T00:00:00.000Z', '2027-01-14'],
  ['2026-12-20T18:00:00.000Z', '2027-01-19'],
  ['2024-02-01T08:00:00.000Z', '2024-03-02'],
  ['2025-02-01T08:00:00.000Z', '2025-03-03'],
  ['2026-10-07T06:21:57.344Z', '2026-11-06'],
];

for (const [activated, expected] of cases) {
  const day = membershipExpiryDay(activated);
  const iso = membershipExpiryIso(activated);
  assert.equal(day, expected, `expiry day for ${activated}`);
  assert.equal(iso.slice(0, 10), day, 'customer date and membership date match');
  assert.equal(iso, `${expected}T12:00:00.000Z`);
}

assert.equal(isPhoneGiveawayCode('  WinWin-Phone  '), true);
assert.equal(isPhoneGiveawayCode('\nWINWIN-PHONE\t'), true);
assert.equal(isPhoneGiveawayCode('winwin - phone'), false);
assert.equal(isPhoneGiveawayCode(''), false);
assert.equal(isPhoneGiveawayCode('winwin-phones'), false);

assert.equal(entries({ itemSubtotal: 19.99, deliveryFee: 20 }), 0);
assert.equal(entries({ itemSubtotal: 20, deliveryFee: 50 }), 1);
assert.equal(entries({ itemSubtotal: 40, deliveryFee: 15 }), 2);
assert.equal(entries({ itemSubtotal: 60, deliveryFee: 10 }), 3);
assert.equal(entries({ itemSubtotal: 60, discount: 20, deliveryFee: 25 }), 2);
assert.equal(entries({ itemSubtotal: 30, discount: 15, deliveryFee: 100 }), 0);
assert.equal(giveawayEligibleSubtotal({ itemSubtotal: 20, deliveryFee: 50 }), giveawayEligibleSubtotal({ itemSubtotal: 20 }));

assert.equal(
  giveawayCheckoutNotice(' winwin-phone ', { itemSubtotal: 19.99, deliveryFee: 30 }),
  GIVEAWAY_MINIMUM_MESSAGE,
);
assert.equal(giveawayCheckoutNotice('WINWIN-PHONE', { itemSubtotal: 20 }), '');
assert.equal(giveawayCheckoutNotice('nope', { itemSubtotal: 10 }), '');
assert.equal(giveawayCheckoutNotice('', { itemSubtotal: 10 }), '');

const plain = message({ subtotal: 40, giveawayCode: '' });
assert.equal(plain.includes('Name: Ada'), true);
assert.equal(plain.includes('1× Soap — $40.00'), true);
assert.equal(plain.includes('Subtotal: $40.00'), true);
assert.equal(plain.includes('Total: $40.00'), true);
assert.equal(plain.includes('Ambassador code: FRIEND'), true);
assert.equal(plain.includes('Notes: Ring the bell'), true);
assert.equal(plain.includes(PHONE_GIVEAWAY_LINE), false);
assert.equal(plain.includes('Phone giveaway entries:'), false);

const invalid = message({ subtotal: 60, giveawayCode: 'winwin - phone' });
assert.equal(invalid.includes(PHONE_GIVEAWAY_LINE), false);
assert.equal(invalid.includes('Phone giveaway entries:'), false);

const low = message({ subtotal: 19.99, giveawayCode: '  WINWIN-PHONE ', deliveryFee: 40 });
assert.deepEqual(low.split('\n').slice(-2), ['', PHONE_GIVEAWAY_LINE]);
assert.equal(low.includes('Phone giveaway entries:'), false);
assert.equal(low.includes('Notes: Ring the bell'), true);

for (const [subtotal, count] of [[20, 1], [40, 2], [60, 3]]) {
  const text = message({ subtotal, giveawayCode: 'winwin-phone', deliveryFee: 12 });
  const lines = text.split('\n');
  assert.equal(lines.at(-2), PHONE_GIVEAWAY_LINE, `line for $${subtotal}`);
  assert.equal(lines.at(-1), `Phone giveaway entries: ${count}`);
  assert.equal(text.includes('Notes: Ring the bell'), true);
  const url = whatsappUrl('0096181629538', text);
  assert.equal(url.includes('\n'), false);
  assert.equal(url.includes(' '), false);
  const decoded = decodeURIComponent(url.split('?text=')[1]);
  assert.equal(decoded, text);
  assert.equal(decoded.split('\n').includes(PHONE_GIVEAWAY_LINE), true);
}

const discounted = message({ subtotal: 60, discount: 20, giveawayCode: 'winwin-phone', deliveryFee: 30 });
assert.equal(discounted.split('\n').at(-1), 'Phone giveaway entries: 2');
assert.equal(discounted.includes('Total: $60.00'), true);

console.log('loyalty and giveaway checks passed');

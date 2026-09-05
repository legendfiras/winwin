import assert from 'node:assert/strict';
import {
  classifyLegacyEmail,
  countEmails,
  mapLegacyRecord,
  normalizeEmail,
  isValidEmail,
  EMAIL_STATUS,
  MIGRATION_STATUS,
  ACCOUNT_SOURCE,
} from '../workers/migration.js';

const records = [
  { id: 'L1', first_name: 'A', last_name: 'One', email: 'a@example.com', points: 2350, phone: '81 111 111' },
  { id: 'L2', first_name: 'B', last_name: 'Two', email: 'bad-email', points: 10 },
  { id: 'L3', first_name: 'C', last_name: 'Three', email: '', points: 5 },
  { id: 'L4', first_name: 'D', last_name: 'Four', email: 'dup@example.com', points: 1 },
  { id: 'L5', first_name: 'E', last_name: 'Five', email: 'DUP@example.com', points: 2 },
  { id: 'L6', first_name: 'F', last_name: 'Six', email: '  valid.two@example.com ', points: 0 },
];

const counts = countEmails(records, (row) => row.email);
assert.equal(counts.get('dup@example.com'), 2);
assert.equal(counts.get('a@example.com'), 1);

const valid = classifyLegacyEmail('a@example.com', counts);
assert.equal(valid.email_status, EMAIL_STATUS.VALID);
assert.equal(valid.migration_status, MIGRATION_STATUS.PENDING);

const missing = classifyLegacyEmail('', counts);
assert.equal(missing.email_status, EMAIL_STATUS.MISSING);
assert.equal(missing.migration_status, MIGRATION_STATUS.NEEDS_RECOVERY);

const invalid = classifyLegacyEmail('not-an-email', counts);
assert.equal(invalid.email_status, EMAIL_STATUS.INVALID);

const dup = classifyLegacyEmail('DUP@example.com', counts);
assert.equal(dup.email_status, EMAIL_STATUS.DUPLICATE);
assert.equal(dup.migration_status, MIGRATION_STATUS.NEEDS_RECOVERY);

assert.equal(isValidEmail('nope'), false);
assert.equal(normalizeEmail('  X@Y.COM '), 'x@y.com');

const mapped = mapLegacyRecord(records[0], counts);
assert.equal(mapped.account_source, ACCOUNT_SOURCE.MIGRATED);
assert.equal(mapped.points, 2350);
assert.equal(mapped.signup_bonus_granted, true);
assert.equal(mapped.password_setup_required, true);
assert.ok(!('password' in mapped));
assert.ok(!('password_hash' in mapped));

console.log('migration classifier tests passed');

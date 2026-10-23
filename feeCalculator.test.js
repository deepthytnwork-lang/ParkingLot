const test = require('node:test');
const assert = require('node:assert');
const { calculateFee } = require('../src/feeCalculator');

const rate = { hourly_rate_cents: 500, daily_cap_cents: 3000, grace_minutes: 10 };
const at = (min) => ({ entryTime: '2026-01-01T00:00:00Z', exitTime: new Date(Date.UTC(2026, 0, 1, 0, min)), rate });

test('within grace is free',            () => assert.strictEqual(calculateFee(at(10)), 0));
test('61 min bills 2 started hours',    () => assert.strictEqual(calculateFee(at(61)), 1000));
test('long same-day stay hits cap',     () => assert.strictEqual(calculateFee(at(12 * 60)), 3000));
test('25 hours = 1 day cap + 1 hour',   () => assert.strictEqual(calculateFee(at(25 * 60)), 3500));
test('exactly 24h = one day cap',       () => assert.strictEqual(calculateFee(at(24 * 60)), 3000));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, calcReadTime } from './format.ts';

test('formatDate: renders long-form English date', () => {
  const d = new Date('2026-08-06T00:00:00Z');
  assert.equal(formatDate(d), 'August 6, 2026');
});

test('calcReadTime: 200 words → 1 minute', () => {
  const text = 'word '.repeat(200).trim();
  assert.equal(calcReadTime(text), 1);
});

test('calcReadTime: 401 words → 3 minutes (rounded up)', () => {
  const text = 'word '.repeat(401).trim();
  assert.equal(calcReadTime(text), 3);
});

test('calcReadTime: empty string → 1 minute (minimum)', () => {
  assert.equal(calcReadTime(''), 1);
});

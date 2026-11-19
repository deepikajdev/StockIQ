import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, formatDate, formatDateTime, formatSignedDelta, cn } from '../utils/format.ts';

describe('Format Utilities', () => {
  describe('formatCurrency', () => {
    it('formats numbers into Indian Rupee format', () => {
      const formatted = formatCurrency(124580);
      assert.ok(formatted.includes('1,24,580'));
      assert.ok(formatted.includes('₹'));
    });

    it('formats decimal strings into Indian Rupee format', () => {
      const formatted = formatCurrency('450.50');
      assert.ok(formatted.includes('450.50'));
      assert.ok(formatted.includes('₹'));
    });

    it('handles zero and null/undefined values safely', () => {
      assert.ok(formatCurrency(0).includes('0.00'));
      assert.ok(formatCurrency(null).includes('0.00'));
      assert.ok(formatCurrency(undefined).includes('0.00'));
    });
  });

  describe('formatSignedDelta', () => {
    it('prepends + for positive numbers', () => {
      assert.equal(formatSignedDelta(15), '+15');
    });

    it('shows minus for negative numbers', () => {
      assert.equal(formatSignedDelta(-8), '-8');
    });

    it('handles 0 without plus or minus sign', () => {
      assert.equal(formatSignedDelta(0), '0');
    });
  });

  describe('Date formatting', () => {
    it('formats UTC ISO date string into DD MMM YYYY', () => {
      const formatted = formatDate('2026-11-17T10:30:00Z');
      assert.ok(formatted.includes('2026'));
      assert.ok(formatted.includes('Nov'));
    });

    it('returns fallback string for invalid date', () => {
      assert.equal(formatDate(null as any), '—');
      assert.equal(formatDate(''), '—');
    });

    it('formats datetime with hour and minute', () => {
      const formatted = formatDateTime('2026-11-17T10:30:00Z');
      assert.ok(formatted.includes('2026'));
      assert.notEqual(formatted, '—');
    });
  });

  describe('cn (Tailwind class merging)', () => {
    it('merges class names correctly', () => {
      assert.equal(cn('px-2 py-1', 'bg-blue-500'), 'px-2 py-1 bg-blue-500');
    });

    it('handles conditional classes', () => {
      const isActive = true;
      const isHidden = false;
      assert.equal(cn('base', isActive && 'active', isHidden && 'hidden'), 'base active');
    });
  });
});

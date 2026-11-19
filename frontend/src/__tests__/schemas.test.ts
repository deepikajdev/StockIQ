import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as z from 'zod';

const adjustmentSchema = z.object({
  product_id: z.coerce.number().min(1, 'Product is required'),
  quantity_change: z.coerce
    .number()
    .refine((val) => val !== 0, 'Quantity change must not be zero'),
  reason: z.enum(['correction', 'damaged', 'lost', 'found', 'opening_balance', 'other'] as const),
  note: z.string().optional(),
});

const productSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(64),
  name: z.string().min(1, 'Product title is required').max(200),
  selling_price: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: 'Selling price must be a non-negative number',
  }),
  cost_price: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: 'Cost price must be a non-negative number',
  }),
});

describe('Zod Validation Schemas', () => {
  describe('Stock Adjustment Schema', () => {
    it('accepts valid positive and negative quantity changes', () => {
      const validPositive = { product_id: 1, quantity_change: 10, reason: 'correction' };
      const validNegative = { product_id: 1, quantity_change: -5, reason: 'damaged' };

      assert.equal(adjustmentSchema.safeParse(validPositive).success, true);
      assert.equal(adjustmentSchema.safeParse(validNegative).success, true);
    });

    it('rejects zero quantity change', () => {
      const zeroQty = { product_id: 1, quantity_change: 0, reason: 'correction' };
      const result = adjustmentSchema.safeParse(zeroQty);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues[0].message.includes('not be zero'));
      }
    });

    it('rejects invalid reason', () => {
      const invalidReason = { product_id: 1, quantity_change: 5, reason: 'stolen' };
      assert.equal(adjustmentSchema.safeParse(invalidReason).success, false);
    });
  });

  describe('Product Schema', () => {
    it('accepts valid product with numeric decimal strings', () => {
      const valid = {
        sku: 'PEN-GEL-05-BLK',
        name: 'Pilot G2 0.5mm Black',
        selling_price: '45.00',
        cost_price: '30.00',
      };
      assert.equal(productSchema.safeParse(valid).success, true);
    });

    it('rejects negative prices', () => {
      const negativePrice = {
        sku: 'TEST',
        name: 'Negative Item',
        selling_price: '-10.00',
        cost_price: '5.00',
      };
      assert.equal(productSchema.safeParse(negativePrice).success, false);
    });

    it('rejects missing or empty SKU', () => {
      const emptySku = {
        sku: '',
        name: 'Item',
        selling_price: '10.00',
        cost_price: '5.00',
      };
      assert.equal(productSchema.safeParse(emptySku).success, false);
    });
  });
});

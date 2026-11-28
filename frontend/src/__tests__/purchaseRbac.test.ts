import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canCreatePurchase,
  canEditPurchase,
  canReceivePurchase,
  canViewPurchases,
} from '../utils/purchaseRbac.ts';

describe('Purchase order RBAC policy', () => {
  it('lets both authenticated roles view purchase orders', () => {
    assert.equal(canViewPurchases('admin'), true);
    assert.equal(canViewPurchases('staff'), true);
  });

  it('restricts purchase order creation to admins', () => {
    assert.equal(canCreatePurchase('admin'), true);
    assert.equal(canCreatePurchase('staff'), false);
  });

  it('restricts purchase order edits to admins', () => {
    assert.equal(canEditPurchase('admin'), true);
    assert.equal(canEditPurchase('staff'), false);
  });

  it('lets both authenticated roles receive existing draft orders', () => {
    assert.equal(canReceivePurchase('admin'), true);
    assert.equal(canReceivePurchase('staff'), true);
  });

  it('denies every purchase action without an authenticated role', () => {
    assert.equal(canViewPurchases(null), false);
    assert.equal(canCreatePurchase(null), false);
    assert.equal(canEditPurchase(undefined), false);
    assert.equal(canReceivePurchase(null), false);
  });
});

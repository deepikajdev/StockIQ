import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { User } from '../types/index.ts';

describe('RBAC (Role-Based Access Control) Rules', () => {
  const adminUser: User = {
    id: 1,
    email: 'admin@stockiq.example.com',
    full_name: 'Store Administrator',
    role: 'admin',
    business_id: 1,
  };

  const staffUser: User = {
    id: 2,
    email: 'staff@stockiq.example.com',
    full_name: 'Floor Staff',
    role: 'staff',
    business_id: 1,
  };

  const canPerformAction = (user: User | null, action: string): boolean => {
    if (!user) return false;
    const adminOnlyActions = [
      'product:create',
      'product:edit',
      'product:deactivate',
      'inventory:adjust',
      'purchase:create',
      'purchase:edit',
      'purchase:cancel',
      'sale:cancel',
      'supplier:create',
      'supplier:edit',
    ];

    if (adminOnlyActions.includes(action)) {
      return user.role === 'admin';
    }

    const generalActions = [
      'catalog:view',
      'inventory:view',
      'pos:create_sale',
      'purchase:receive',
      'sales:view',
      'suppliers:view',
    ];

    return generalActions.includes(action);
  };

  it('allows admin full administrative permissions', () => {
    assert.equal(canPerformAction(adminUser, 'product:create'), true);
    assert.equal(canPerformAction(adminUser, 'inventory:adjust'), true);
    assert.equal(canPerformAction(adminUser, 'purchase:create'), true);
    assert.equal(canPerformAction(adminUser, 'purchase:edit'), true);
    assert.equal(canPerformAction(adminUser, 'supplier:create'), true);
    assert.equal(canPerformAction(adminUser, 'sale:cancel'), true);
  });

  it('restricts staff from privileged write operations', () => {
    assert.equal(canPerformAction(staffUser, 'product:create'), false);
    assert.equal(canPerformAction(staffUser, 'inventory:adjust'), false);
    assert.equal(canPerformAction(staffUser, 'purchase:create'), false);
    assert.equal(canPerformAction(staffUser, 'purchase:edit'), false);
    assert.equal(canPerformAction(staffUser, 'supplier:create'), false);
    assert.equal(canPerformAction(staffUser, 'sale:cancel'), false);
  });

  it('allows staff to execute operational tasks (POS sales & PO receiving)', () => {
    assert.equal(canPerformAction(staffUser, 'pos:create_sale'), true);
    assert.equal(canPerformAction(staffUser, 'purchase:receive'), true);
    assert.equal(canPerformAction(staffUser, 'catalog:view'), true);
  });

  it('blocks unauthenticated access from any action', () => {
    assert.equal(canPerformAction(null, 'catalog:view'), false);
    assert.equal(canPerformAction(null, 'pos:create_sale'), false);
  });
});

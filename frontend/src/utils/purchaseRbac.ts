import type { UserRole } from '../types';

export type PurchaseRole = UserRole | null | undefined;

// Purchase-order permissions are shared by the purchase UI and the RBAC
// verification matrix so the documented policy cannot drift from the controls.
export const canViewPurchases = (role: PurchaseRole): boolean =>
  role === 'admin' || role === 'staff';

export const canCreatePurchase = (role: PurchaseRole): boolean => role === 'admin';

export const canEditPurchase = (role: PurchaseRole): boolean => role === 'admin';

export const canReceivePurchase = (role: PurchaseRole): boolean =>
  role === 'admin' || role === 'staff';

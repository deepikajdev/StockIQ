import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingCart,
  Receipt,
  Truck,
  Users,
  AlertTriangle,
  History,
  BarChart3,
  ShieldAlert,
  LogOut,
  Store,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../utils/format';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Inventory', href: '/inventory', icon: Layers },
  { name: 'New Sale (POS)', href: '/pos', icon: ShoppingCart },
  { name: 'Sales History', href: '/sales', icon: Receipt },
  { name: 'Purchases', href: '/purchases', icon: Truck },
  { name: 'Suppliers', href: '/suppliers', icon: Users },
  { name: 'Alerts & Reorder', href: '/alerts', icon: AlertTriangle, badge: 'Low' },
  { name: 'Movement History', href: '/movements', icon: History },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Role Variants', href: '/role-variants', icon: ShieldAlert },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-full w-[248px] bg-surface-container-lowest border-r border-outline-variant/30 z-40 flex-col justify-between select-none shadow-[0_1px_8px_rgba(0,0,0,0.02)]">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center gap-2.5 border-b border-outline-variant/20 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary-container via-primary to-secondary flex items-center justify-center text-white shadow-xs">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-section-title text-[17px] leading-tight text-on-surface font-bold tracking-tight">
              StockIQ
            </span>
            <span className="font-caption text-[11px] leading-none text-on-surface-variant font-medium">
              Intelligence Suite
            </span>
          </div>
        </div>

        {/* Store Selector Pill */}
        <div className="p-3">
          <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low border border-outline-variant/20 hover:bg-surface-container transition-colors cursor-pointer">
            <div className="flex items-center gap-2 overflow-hidden">
              <Store className="w-4 h-4 text-secondary shrink-0" />
              <span className="font-body-medium text-[12px] text-on-surface truncate">
                Stationery & Gifts
              </span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all',
                    isActive
                      ? 'bg-primary-container text-white shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={cn(
                          'w-4 h-4 shrink-0 transition-colors',
                          isActive
                            ? 'text-white'
                            : 'text-on-surface-variant group-hover:text-primary'
                        )}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase',
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-amber-100 text-amber-800'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer / User Profile */}
      <div className="p-3 border-t border-outline-variant/20 shrink-0 bg-surface-container-low/40">
        <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex flex-col truncate">
              <span className="font-body-medium text-[12px] text-on-surface truncate">
                {user?.full_name || 'StockIQ User'}
              </span>
              <span className="font-caption text-[10px] text-on-surface-variant capitalize">
                {user?.role || 'Staff'} Mode
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 rounded-md text-on-surface-variant hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

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
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../utils/format';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const mobileItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Inventory', href: '/inventory', icon: Layers },
  { name: 'New Sale (POS)', href: '/pos', icon: ShoppingCart },
  { name: 'Sales History', href: '/sales', icon: Receipt },
  { name: 'Purchases', href: '/purchases', icon: Truck },
  { name: 'Suppliers', href: '/suppliers', icon: Users },
  { name: 'Alerts & Reorders', href: '/alerts', icon: AlertTriangle },
  { name: 'Movement History', href: '/movements', icon: History },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 left-0 w-72 bg-surface-container-lowest shadow-xl flex flex-col justify-between border-r border-outline-variant/30">
        <div className="p-4 flex items-center justify-between border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="font-section-title text-[16px] font-bold text-on-surface">
              StockIQ
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-on-surface-variant hover:bg-surface-container"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-primary-container text-white'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  )
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low/40 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[12px] font-medium text-on-surface">
              {user?.full_name}
            </span>
            <span className="text-[11px] text-on-surface-variant capitalize">
              {user?.role}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-on-surface-variant hover:text-rose-600"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

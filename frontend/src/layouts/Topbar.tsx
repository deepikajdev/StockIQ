import React from 'react';
import { Search, Bell, Sun, Shield, Menu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface TopbarProps {
  onToggleMobileNav?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleMobileNav }) => {
  const { user } = useAuth();

  return (
    <header className="h-16 fixed top-0 right-0 left-0 lg:left-[248px] bg-surface-container-lowest border-b border-outline-variant/30 z-30 px-4 md:px-6 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
      {/* Mobile Hamburger Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileNav}
          className="lg:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Bar */}
        <div className="hidden sm:flex items-center gap-2 h-9 w-64 md:w-80 px-3 rounded-lg bg-surface-container-low border border-outline-variant/30 text-on-surface-variant cursor-pointer hover:bg-surface-container transition-colors">
          <Search className="w-4 h-4 text-on-surface-variant shrink-0" />
          <span className="font-body-default text-[13px] flex-1 truncate text-outline">
            Quick search products, SKUs, actions...
          </span>
          <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-surface-container-highest text-on-surface-variant rounded border border-outline-variant/40 shadow-2xs">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Tools & User Info */}
      <div className="flex items-center gap-2 md:gap-3">
        <button
          title="Notifications"
          className="relative p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
        </button>

        <button
          title="Theme"
          className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <Sun className="w-4 h-4" />
        </button>

        <div className="h-5 w-px bg-outline-variant/40 mx-1" />

        {/* User Role Badge */}
        <div className="flex items-center gap-2 pl-1">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-overline text-[11px] font-semibold uppercase tracking-wider">
            <Shield className="w-3 h-3 text-secondary" />
            <span>{user?.role || 'Staff'}</span>
          </span>
        </div>
      </div>
    </header>
  );
};

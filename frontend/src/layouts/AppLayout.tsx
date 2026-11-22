import React, { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';

export const AppLayout: React.FC = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Drawer Navigation */}
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main Content Stage */}
      <div className="flex-1 lg:pl-[248px] flex flex-col min-w-0">
        <Topbar onToggleMobileNav={() => setMobileNavOpen(true)} />

        <main className="flex-1 pt-16 p-4 md:p-6 lg:p-8 max-w-[1440px] w-full mx-auto overflow-y-auto">
          <Suspense
            fallback={
              <div
                className="flex min-h-[40vh] items-center justify-center text-on-surface-variant"
                role="status"
                aria-live="polite"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="text-sm">Loading page…</span>
                </div>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

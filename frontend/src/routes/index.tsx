import React, { lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AppLayout } from '../layouts/AppLayout';
import { Login } from '../pages/Login';
import { NotFound } from '../pages/NotFound';

// Heavy pages load on demand. Dashboard, ProductDetail and Reports pull in the
// charting vendor chunk, so the login and application shell stay lightweight.
const Dashboard = lazy(() =>
  import('../pages/Dashboard').then((m) => ({ default: m.Dashboard }))
);
const Products = lazy(() => import('../pages/Products').then((m) => ({ default: m.Products })));
const ProductDetail = lazy(() =>
  import('../pages/ProductDetail').then((m) => ({ default: m.ProductDetail }))
);
const Inventory = lazy(() => import('../pages/Inventory').then((m) => ({ default: m.Inventory })));
const NewSale = lazy(() => import('../pages/NewSale').then((m) => ({ default: m.NewSale })));
const SalesHistory = lazy(() =>
  import('../pages/SalesHistory').then((m) => ({ default: m.SalesHistory }))
);
const Purchases = lazy(() => import('../pages/Purchases').then((m) => ({ default: m.Purchases })));
const Suppliers = lazy(() => import('../pages/Suppliers').then((m) => ({ default: m.Suppliers })));
const AlertsReorder = lazy(() =>
  import('../pages/AlertsReorder').then((m) => ({ default: m.AlertsReorder }))
);
const MovementHistory = lazy(() =>
  import('../pages/MovementHistory').then((m) => ({ default: m.MovementHistory }))
);
const Reports = lazy(() => import('../pages/Reports').then((m) => ({ default: m.Reports })));
const RoleVariants = lazy(() =>
  import('../pages/RoleVariants').then((m) => ({ default: m.RoleVariants }))
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login" element={<Login />} />

      {/* Authenticated Application Shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="pos" element={<NewSale />} />
        <Route path="sales/new" element={<Navigate to="/pos" replace />} />
        <Route path="sales" element={<SalesHistory />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="alerts" element={<AlertsReorder />} />
        <Route path="movements" element={<MovementHistory />} />
        <Route path="reports" element={<Reports />} />
        <Route path="role-variants" element={<RoleVariants />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

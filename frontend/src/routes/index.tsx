import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AppLayout } from '../layouts/AppLayout';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { Products } from '../pages/Products';
import { ProductDetail } from '../pages/ProductDetail';
import { Inventory } from '../pages/Inventory';
import { NewSale } from '../pages/NewSale';
import { SalesHistory } from '../pages/SalesHistory';
import { Purchases } from '../pages/Purchases';
import { Suppliers } from '../pages/Suppliers';
import { AlertsReorder } from '../pages/AlertsReorder';
import { MovementHistory } from '../pages/MovementHistory';
import { Reports } from '../pages/Reports';
import { RoleVariants } from '../pages/RoleVariants';
import { NotFound } from '../pages/NotFound';

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

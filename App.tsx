import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useIsMobile } from './hooks/useIsMobile';
import Layout from './components/Layout';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Lazy Load Pages for Performance
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Inventory = React.lazy(() => import('./pages/Inventory'));
const Machines = React.lazy(() => import('./pages/Machines'));
const Orders = React.lazy(() => import('./pages/Orders'));
const Stocktaking = React.lazy(() => import('./pages/Stocktaking'));
const StockAudit = React.lazy(() => import('./pages/StockAudit'));
const Warehouses = React.lazy(() => import('./pages/Warehouses'));
const Suppliers = React.lazy(() => import('./pages/Suppliers'));
const Labels = React.lazy(() => import('./pages/Labels'));
const Commissions = React.lazy(() => import('./pages/Commissions'));
const ShelfEditor = React.lazy(() => import('./pages/ShelfEditor'));
const Keys = React.lazy(() => import('./pages/Keys'));
const Login = React.lazy(() => import('./pages/Login'));
const Workwear = React.lazy(() => import('./pages/Workwear'));
const PrintProtocol = React.lazy(() => import('./pages/PrintProtocol'));
const ImageOptimizer = React.lazy(() => import('./pages/ImageOptimizer'));

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Loader2 } from 'lucide-react';
import { ReloadPrompt } from './components/ReloadPrompt';
import { ChangelogModal } from './components/ChangelogModal';

// Protected Route Wrapper
const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-900">
        <Loader2 size={40} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  // AUTH CHECK: Redirect to login if no user is present
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};


const queryClient = new QueryClient();

const App: React.FC = () => {

  const isMobile = useIsMobile();

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig transition={isMobile ? { duration: 0 } : undefined}>
        <AuthProvider>
          <NotificationProvider>
            <ThemeProvider>
              <HashRouter>
                <React.Suspense fallback={
                  <div className="min-h-screen w-full flex items-center justify-center bg-gray-900">
                    <Loader2 size={40} className="animate-spin text-emerald-500" />
                    <span className="ml-3 text-emerald-500 font-medium">Lade Anwendung...</span>
                  </div>
                }>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/print-protocol" element={<PrintProtocol />} />

                    <Route element={<ProtectedRoute />}>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/inventory" element={<Inventory />} />
                      <Route path="/machines" element={<Machines />} />
                      <Route path="/orders" element={<Orders />} />
                      <Route path="/stocktaking" element={<Stocktaking />} />
                      <Route path="/audit" element={<StockAudit />} />
                      <Route path="/warehouses" element={<Warehouses />} />
                      <Route path="/suppliers" element={<Suppliers />} />
                      <Route path="/labels" element={<Labels />} />
                      <Route path="/commissions" element={<Commissions />} />
                      <Route path="/shelf-editor" element={<ShelfEditor />} />
                      <Route path="/keys" element={<Keys />} />
                      <Route path="/workwear" element={<Workwear />} />
                      <Route path="/image-optimizer" element={<ImageOptimizer />} />
                    </Route>
                  </Routes>
                </React.Suspense>
              </HashRouter>
              <ChangelogModal />
            </ThemeProvider>
          </NotificationProvider>
          <ReloadPrompt />
        </AuthProvider >
      </MotionConfig>
    </QueryClientProvider>
  );
};

export default App;

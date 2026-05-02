import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useIsMobile } from './hooks/useIsMobile';
import Layout from './src/components/Layout';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Lazy Load Pages for Performance
const Dashboard = React.lazy(() => import('./src/features/dashboard/Dashboard'));
const Inventory = React.lazy(() => import('./src/features/inventory/Inventory'));
const Machines = React.lazy(() => import('./src/features/machines/Machines'));
const Orders = React.lazy(() => import('./src/features/orders/Orders'));
const Stocktaking = React.lazy(() => import('./src/features/inventory/Stocktaking'));
const StockAudit = React.lazy(() => import('./src/features/inventory/StockAudit'));
const Warehouses = React.lazy(() => import('./src/features/warehouses/Warehouses'));
const Suppliers = React.lazy(() => import('./src/features/suppliers/Suppliers'));
const Labels = React.lazy(() => import('./src/features/labels/Labels'));
const Commissions = React.lazy(() => import('./src/features/commissions/Commissions'));
const ShelfEditor = React.lazy(() => import('./src/features/inventory/ShelfEditor'));
const Keys = React.lazy(() => import('./src/features/keys/Keys'));
const Login = React.lazy(() => import('./src/pages/Login'));
const Workwear = React.lazy(() => import('./src/features/workwear/Workwear'));
const PrintProtocol = React.lazy(() => import('./src/pages/PrintProtocol'));
const ImageOptimizer = React.lazy(() => import('./src/features/tools/ImageOptimizer'));

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Loader2 } from 'lucide-react';
import { ReloadPrompt } from './src/components/ReloadPrompt';
import { ChangelogModal } from './src/components/ChangelogModal';

// Protected Route Wrapper
const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-transparent">
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
      <React.Suspense fallback={
        <div className="h-full w-full flex flex-col items-center justify-center">
          <Loader2 size={40} className="animate-spin text-emerald-500 mb-4" />
          <span className="text-emerald-500/70 font-medium">Lade Ansicht...</span>
        </div>
      }>
        <Outlet />
      </React.Suspense>
    </Layout>
  );
};


const queryClient = new QueryClient();

const App: React.FC = () => {

  const isMobile = useIsMobile();

  // --- DISABLE PULL TO REFRESH (JS SAFEGUARD) ---
  useEffect(() => {
    if (!isMobile) return;

    const preventPullToRefresh = (e: TouchEvent) => {
      // If we are at the top and pulling down, prevent default browser refresh
      if (window.scrollY === 0 && e.touches[0].pageY > 0) {
        // We only prevent it if we're not inside a scrollable element that should scroll
        // But for most PWA cases, global prevention is desired.
      }
    };

    // Use passive: false to allow preventDefault
    document.addEventListener('touchstart', preventPullToRefresh, { passive: true });
    
    return () => {
      document.removeEventListener('touchstart', preventPullToRefresh);
    };
  }, [isMobile]);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig transition={isMobile ? { duration: 0 } : undefined}>
        <ConnectionProvider>
          <AuthProvider>
            <UserPreferencesProvider>
              <NotificationProvider>
                <ThemeProvider>
                  <HashRouter>
                    <React.Suspense fallback={
                      <div className="min-h-screen w-full flex items-center justify-center bg-transparent">
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
            </UserPreferencesProvider>
          </AuthProvider >
        </ConnectionProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
};

export default App;

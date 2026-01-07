import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useIsMobile } from './hooks/useIsMobile';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Machines from './pages/Machines';
import Orders from './pages/Orders';
import Stocktaking from './pages/Stocktaking';
import StockAudit from './pages/StockAudit';
import Warehouses from './pages/Warehouses';
import Suppliers from './pages/Suppliers';
import Labels from './pages/Labels';
import Commissions from './pages/Commissions';
import ShelfEditor from './pages/ShelfEditor';
import Keys from './pages/Keys';
import Login from './pages/Login';
import Workwear from './pages/Workwear';
import PrintProtocol from './pages/PrintProtocol';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Loader2 } from 'lucide-react';
import { initializeDatabase } from './utils/dbInit';
import { ReloadPrompt } from './components/ReloadPrompt';

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

// Declare OneSignal on window to avoid TS errors
declare global {
  interface Window {
    OneSignalDeferred: any[];
  }
}

const App: React.FC = () => {

  // Vibe Coding: Auto-Init Database on App Start
  useEffect(() => {
    initializeDatabase(true);
  }, []);

  const isMobile = useIsMobile();

  // --- ONESIGNAL INITIALIZATION ---
  useEffect(() => {
    // Skip on localhost if triggering domain errors
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log("OneSignal disabled on localhost to prevent domain errors.");
      return;
    }

    if (typeof window !== 'undefined') {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal: any) {
        try {
          await OneSignal.init({
            // -------------------------------------------------------
            // TODO: HIER DEINE ONESIGNAL APP ID EINFÜGEN
            // -------------------------------------------------------
            appId: "f5da4139-8119-4349-828a-70002617f157",

            // Erlaubt lokale Tests (localhost), auf Produktion auf false setzen oder entfernen
            allowLocalhostAsSecureOrigin: true,

            // Zeigt eine kleine Glocke an, damit Nutzer Notifications später aktivieren können
            notifyButton: {
              enable: true,
              size: 'medium',
              theme: 'inverse',
              position: 'bottom-left',
            },
          });
        } catch (error) {
          console.warn("OneSignal init failed:", error);
        }
      });
    }
  }, []);

  return (
    <MotionConfig transition={isMobile ? { duration: 0 } : undefined}>
      <AuthProvider>
        <NotificationProvider>
          <ThemeProvider>
            <HashRouter>
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
                </Route>
              </Routes>
            </HashRouter>
          </ThemeProvider>
        </NotificationProvider>
        <ReloadPrompt />
      </AuthProvider >
    </MotionConfig>
  );
};

export default App;

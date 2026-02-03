
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

interface ConnectionContextType {
  isConnected: boolean;
  checkConnection: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextType>({
  isConnected: true,
  checkConnection: async () => { },
});

export const useConnection = () => useContext(ConnectionContext);

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Safe initialization for navigator.onLine to prevent build errors
  const [isConnected, setIsConnected] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsConnected(true);
      checkConnection(); // Verify DB access on reconnect
    };
    const handleOffline = () => setIsConnected(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initial Connection Check (Heartbeat)
  const checkConnection = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsConnected(false);
      return;
    }
    try {
      // Simple lightweight query to check DB reachability
      const { error } = await supabase.from('warehouses').select('id').limit(1);
      if (error) {
        console.warn("DB unreachable:", error);
      }
      setIsConnected(true);
    } catch (err) {
      console.error("Connection check failed:", err);
      setIsConnected(false);
    }
  };

  return (
    <ConnectionContext.Provider value={{ isConnected, checkConnection }}>
      {children}
    </ConnectionContext.Provider>
  );
};

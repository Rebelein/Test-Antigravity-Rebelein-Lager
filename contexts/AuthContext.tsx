
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { UserProfile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isConnected: boolean; // New global state
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateWarehousePreference: (type: 'primary' | 'secondary', warehouseId: string) => Promise<void>;
  toggleCategoryCollapse: (category: string) => Promise<void>;
  checkConnection: () => Promise<void>; // Manual retry
  markTourSeen: () => Promise<void>; // Update tour status
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isConnected: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  updateWarehousePreference: async () => {},
  toggleCategoryCollapse: async () => {},
  checkConnection: async () => {},
  markTourSeen: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Safe initialization for navigator.onLine to prevent build errors
  const [isConnected, setIsConnected] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  // DEV MODE: Set to false for Production/Live usage to ensure real DB auth
  const IS_DEV_MODE = false;
  const DEV_USER_ID = '7416346d-0d2a-4027-b2a7-cf603c4bced1'; 

  // --- CONNECTION MONITORING ---
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

  // --- AUTH & PROFILE LOGIC ---
  useEffect(() => {
    if (IS_DEV_MODE) {
        // Simulate a logged-in user immediately using the REAL UUID
        const devUser = { id: DEV_USER_ID, email: 'dev@rebelein.app' } as User;
        const devSession = { user: devUser, access_token: 'mock-token' } as Session;
        
        setSession(devSession);
        setUser(devUser);
        
        fetchProfile(DEV_USER_ID);
        return;
    }

    // Real Auth Logic
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- REALTIME PROFILE SYNC ---
  // This ensures that if the user changes warehouse settings on one device,
  // it updates immediately on all other connected devices/tabs.
  useEffect(() => {
      if (!user) return;

      const channel = supabase.channel(`profile_updates_${user.id}`)
          .on(
              'postgres_changes',
              { 
                  event: 'UPDATE', 
                  schema: 'public', 
                  table: 'profiles', 
                  filter: `id=eq.${user.id}` 
              },
              (payload) => {
                  console.log('Profile updated via Realtime:', payload);
                  const newProfile = payload.new as UserProfile;
                  // Merge with existing to keep local optimistic state if needed, but usually replace
                  setProfile(prev => ({ ...prev, ...newProfile }));
              }
          )
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, [user]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        if (IS_DEV_MODE && userId === DEV_USER_ID) {
            setProfile({
                id: userId,
                email: 'dev@rebelein.app',
                full_name: 'Dev User (Real UUID)',
                role: 'admin',
                primary_warehouse_id: undefined,
                secondary_warehouse_id: undefined,
                collapsed_categories: [],
                has_seen_tour: false // Default for dev
            });
        }
      } else {
        setProfile({
            id: userId,
            email: user?.email || 'dev@rebelein.app',
            full_name: data.full_name,
            role: data.role,
            avatar_url: data.avatar_url,
            primary_warehouse_id: data.primary_warehouse_id,
            secondary_warehouse_id: data.secondary_warehouse_id,
            collapsed_categories: data.collapsed_categories || [],
            has_seen_tour: data.has_seen_tour
        });
      }
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
      if (user) {
          await fetchProfile(user.id);
      }
  };

  const updateWarehousePreference = async (type: 'primary' | 'secondary', warehouseId: string) => {
    if (!user) return;
    try {
      const column = type === 'primary' ? 'primary_warehouse_id' : 'secondary_warehouse_id';
      const updates: any = { [column]: warehouseId };
      
      // Logic: A warehouse cannot be both primary and secondary at the same time.
      // Swap or clear if needed.
      if (type === 'primary' && profile?.secondary_warehouse_id === warehouseId) {
          updates.secondary_warehouse_id = null;
      }
      if (type === 'secondary' && profile?.primary_warehouse_id === warehouseId) {
          updates.primary_warehouse_id = null;
      }

      // Optimistic UI Update (Immediate feedback)
      setProfile(prev => prev ? { ...prev, ...updates } : null);

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      // Note: Realtime subscription will double-check this, but optimistic update makes it feel instant.
    } catch (error) {
      console.error(`Error updating ${type} warehouse:`, error);
      // Revert on error would go here
      await refreshProfile();
      throw error;
    }
  };

  const toggleCategoryCollapse = async (category: string) => {
    if (!profile || !user) return;
    const currentCollapsed = profile.collapsed_categories || [];
    let newCollapsed: string[];
    if (currentCollapsed.includes(category)) {
        newCollapsed = currentCollapsed.filter(c => c !== category);
    } else {
        newCollapsed = [...currentCollapsed, category];
    }
    
    // Optimistic Update
    setProfile({ ...profile, collapsed_categories: newCollapsed });
    
    try {
        await supabase.from('profiles').update({ collapsed_categories: newCollapsed }).eq('id', user.id);
    } catch (error: any) {
        console.error("Error saving category state:", error);
    }
  };

  const markTourSeen = async () => {
      if (!user || !profile) return;
      
      // Optimistic update
      setProfile({ ...profile, has_seen_tour: true });
      
      try {
          await supabase.from('profiles').update({ has_seen_tour: true }).eq('id', user.id);
      } catch (error) {
          console.error("Error marking tour as seen:", error);
      }
  };

  const signOut = async () => {
    if (IS_DEV_MODE) {
        alert("Logout im Entwickler-Modus deaktiviert.");
        return;
    }
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, isConnected, signOut, refreshProfile, updateWarehousePreference, toggleCategoryCollapse, checkConnection, markTourSeen }}>
      {children}
    </AuthContext.Provider>
  );
};

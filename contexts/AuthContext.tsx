
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { UserProfile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => { },
  refreshProfile: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // DEV MODE: Set to false for Production/Live usage to ensure real DB auth
  const IS_DEV_MODE = false;
  const DEV_USER_ID = '7416346d-0d2a-4027-b2a7-cf603c4bced1';

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
          has_seen_tour: data.has_seen_tour,
          workwear_role: data.workwear_role
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

  const signOut = async () => {
    if (IS_DEV_MODE) {
      alert("Logout im Entwickler-Modus deaktiviert.");
      return;
    }
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

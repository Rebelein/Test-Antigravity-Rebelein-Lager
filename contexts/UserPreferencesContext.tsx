
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { UserProfile } from '../types';

interface UserPreferencesContextType {
    primaryWarehouseId?: string;
    secondaryWarehouseId?: string;
    collapsedCategories: string[];
    hasSeenTour?: boolean;
    updateWarehousePreference: (type: 'primary' | 'secondary', warehouseId: string) => Promise<void>;
    toggleCategoryCollapse: (category: string) => Promise<void>;
    markTourSeen: () => Promise<void>;
}

const UserPreferencesContext = createContext<UserPreferencesContextType>({
    collapsedCategories: [],
    updateWarehousePreference: async () => { },
    toggleCategoryCollapse: async () => { },
    markTourSeen: async () => { },
});

export const useUserPreferences = () => useContext(UserPreferencesContext);

export const UserPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile, refreshProfile } = useAuth();

    // Local state for immediate UI feedback (Optimistic UI)
    // We initialize from profile but keep local copy for instant updates
    const [prefs, setPrefs] = useState({
        primaryWarehouseId: profile?.primary_warehouse_id,
        secondaryWarehouseId: profile?.secondary_warehouse_id,
        collapsedCategories: profile?.collapsed_categories || [],
        hasSeenTour: profile?.has_seen_tour
    });

    // Sync with profile when it changes (e.g. initial load or external update)
    useEffect(() => {
        if (profile) {
            setPrefs({
                primaryWarehouseId: profile.primary_warehouse_id,
                secondaryWarehouseId: profile.secondary_warehouse_id,
                collapsedCategories: profile.collapsed_categories || [],
                hasSeenTour: profile.has_seen_tour
            });
        }
    }, [profile]);

    const updateWarehousePreference = async (type: 'primary' | 'secondary', warehouseId: string) => {
        if (!user) return;

        // 1. Optimistic Update
        setPrefs(prev => {
            const updates: any = {};
            if (type === 'primary') {
                updates.primaryWarehouseId = warehouseId;
                // Clear secondary if it matches
                if (prev.secondaryWarehouseId === warehouseId) updates.secondaryWarehouseId = undefined;
            } else {
                updates.secondaryWarehouseId = warehouseId;
                // Clear primary if it matches
                if (prev.primaryWarehouseId === warehouseId) updates.primaryWarehouseId = undefined;
            }
            return { ...prev, ...updates };
        });

        try {
            const column = type === 'primary' ? 'primary_warehouse_id' : 'secondary_warehouse_id';
            const updates: any = { [column]: warehouseId };

            // Server Logic: A warehouse cannot be both primary and secondary at the same time.
            if (type === 'primary' && profile?.secondary_warehouse_id === warehouseId) {
                updates.secondary_warehouse_id = null;
            }
            if (type === 'secondary' && profile?.primary_warehouse_id === warehouseId) {
                updates.primary_warehouse_id = null;
            }

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) throw error;

            // Trigger profile refresh to ensure consistency
            await refreshProfile();

        } catch (error) {
            console.error(`Error updating ${type} warehouse:`, error);
            // Revert would happen automatically on next profile fetch if we didn't update local state, 
            // but for now we assume success or user will retry.
            await refreshProfile();
        }
    };

    const toggleCategoryCollapse = async (category: string) => {
        if (!user) return;

        const currentCollapsed = prefs.collapsedCategories;
        let newCollapsed: string[];

        if (currentCollapsed.includes(category)) {
            newCollapsed = currentCollapsed.filter(c => c !== category);
        } else {
            newCollapsed = [...currentCollapsed, category];
        }

        // Optimistic Update
        setPrefs(prev => ({ ...prev, collapsedCategories: newCollapsed }));

        try {
            // We don't await refreshProfile here to keep it fast, 
            // and we don't strictly need the global profile to update immediately for this UI state.
            await supabase.from('profiles').update({ collapsed_categories: newCollapsed }).eq('id', user.id);
        } catch (error: any) {
            console.error("Error saving category state:", error);
        }
    };

    const markTourSeen = async () => {
        if (!user) return;

        // Optimistic update
        setPrefs(prev => ({ ...prev, hasSeenTour: true }));

        try {
            await supabase.from('profiles').update({ has_seen_tour: true }).eq('id', user.id);
            // Update global profile eventually
            refreshProfile();
        } catch (error) {
            console.error("Error marking tour as seen:", error);
        }
    };

    return (
        <UserPreferencesContext.Provider value={{
            ...prefs,
            updateWarehousePreference,
            toggleCategoryCollapse,
            markTourSeen
        }}>
            {children}
        </UserPreferencesContext.Provider>
    );
};

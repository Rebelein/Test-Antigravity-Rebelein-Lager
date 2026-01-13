import { useState, useEffect, useCallback } from 'react';

// Custom event for cross-tab synchronization
const STORAGE_EVENT = 'storage';

/**
 * A hook to safely persist state in localStorage with built-in migration support.
 * 
 * @param key The localStorage key
 * @param initialValue The default value if nothing is saved
 * @param options.migrate Optional function to merge/migrate saved data with the current schema
 * @returns [value, setValue]
 */
export function usePersistentState<T>(
    key: string,
    initialValue: T,
    options?: {
        migrate?: (saved: any, initial: T) => T
    }
): [T, (value: T | ((val: T) => T)) => void] {
    // 1. Initialize State
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            if (typeof window === 'undefined') return initialValue;

            const item = window.localStorage.getItem(key);
            if (!item) return initialValue;

            const parsed = JSON.parse(item);

            // 2. Run Migration if provided
            if (options?.migrate) {
                return options.migrate(parsed, initialValue);
            }

            return parsed;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    // 3. Setter Function
    const setValue = useCallback((value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);

            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
                // Dispatch event for other hooks in the same tab to update
                window.dispatchEvent(new Event('local-storage'));
            }
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    // 4. Sync across tabs/windows
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key && e.newValue) {
                try {
                    const newValue = JSON.parse(e.newValue);
                    setStoredValue(options?.migrate ? options.migrate(newValue, initialValue) : newValue);
                } catch (error) {
                    console.error("Error syncing storage:", error);
                }
            }
        };

        // Custom event for same-tab synchronization (e.g. creating same hook in multiple places)
        const handleLocalEvent = () => {
            try {
                const item = window.localStorage.getItem(key);
                if (item) {
                    const newValue = JSON.parse(item);
                    setStoredValue(options?.migrate ? options.migrate(newValue, initialValue) : newValue);
                }
            } catch (error) {
                console.error("Error syncing local storage:", error);
            }
        };

        window.addEventListener(STORAGE_EVENT, handleStorageChange);
        window.addEventListener('local-storage', handleLocalEvent);

        return () => {
            window.removeEventListener(STORAGE_EVENT, handleStorageChange);
            window.removeEventListener('local-storage', handleLocalEvent);
        };
    }, [key, initialValue, options?.migrate]);

    return [storedValue, setValue];
}

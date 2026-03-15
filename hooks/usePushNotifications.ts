import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/supabaseClient';

// ============================================================
// VAPID Public Key (wird für die Push-Subscription benötigt)
// Dieser Wert ist ÖFFENTLICH und kann im Frontend verwendet werden.
// ============================================================
const VAPID_PUBLIC_KEY = 'BFF6_0iEjpcsYrjLrA6VHdMREw6qMvmvVoVNNdihqU3GwRPjU8wzoLv4wbvwu2eoW20XHKEx3tuHl2R_oH-gzUo';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface UsePushNotificationsReturn {
  /** Gibt an ob Push-Benachrichtigungen unterstützt werden */
  isSupported: boolean;
  /** Aktueller Permission-Status: 'default' | 'granted' | 'denied' */
  permission: NotificationPermission;
  /** Push-Berechtigung anfordern und Subscription in DB speichern */
  requestPermission: () => Promise<boolean>;
  /** Subscription deaktivieren und aus DB entfernen */
  unsubscribe: () => Promise<void>;
  /** Ist der User aktuell subscribed? */
  isSubscribed: boolean;
}

/**
 * Hook für Web Push Benachrichtigungen in der LagerApp.
 * Verwaltet automatisch die Subscription und speichert sie in Supabase.
 */
export function usePushNotifications(userId: string | null): UsePushNotificationsReturn {
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const permissionRef = useRef<NotificationPermission>(
    isSupported ? Notification.permission : 'denied'
  );
  const isSubscribedRef = useRef(false);

  // Beim Mounten: Prüfen ob bereits subscribed
  useEffect(() => {
    if (!isSupported || !userId) return;

    const checkExistingSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          // Prüfen ob in DB vorhanden
          const { data } = await supabase
            .from('push_subscriptions')
            .select('id')
            .eq('user_id', userId)
            .eq('app_name', 'lager')
            .eq('subscription->>endpoint', existingSub.endpoint)
            .maybeSingle();

          isSubscribedRef.current = !!data;

          // Falls in Browser aber nicht in DB: neu registrieren
          if (!data && Notification.permission === 'granted') {
            await saveSubscriptionToDB(existingSub, userId);
            isSubscribedRef.current = true;
          }
        }
        permissionRef.current = Notification.permission;
      } catch (err) {
        console.error('[Push] Fehler beim Prüfen der Subscription:', err);
      }
    };

    checkExistingSubscription();
  }, [userId, isSupported]);

  const saveSubscriptionToDB = async (
    subscription: PushSubscription,
    uid: string
  ): Promise<boolean> => {
    try {
      const subJson = subscription.toJSON();
      const endpoint = subJson.endpoint;

      // Prüfen ob bereits vorhanden (Expression-Index verhindert Duplikat beim INSERT)
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', uid)
        .eq('app_name', 'lager')
        .eq('subscription->>endpoint', endpoint)
        .maybeSingle();

      if (existing) {
        // Bereits vorhanden – kein Duplikat einfügen
        return true;
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: uid,
          app_name: 'lager',
          subscription: subJson,
          user_agent: navigator.userAgent.substring(0, 200),
        });

      if (error) {
        console.error('[Push] DB-Fehler beim Speichern:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[Push] Fehler beim Speichern der Subscription:', err);
      return false;
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !userId) {
      console.warn('[Push] Nicht unterstützt oder kein User');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      permissionRef.current = permission;

      if (permission !== 'granted') {
        console.info('[Push] Berechtigung verweigert');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;

      // Bestehende Subscription abrufen oder neue erstellen
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const vapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey.buffer as ArrayBuffer,
        });
      }

      const saved = await saveSubscriptionToDB(subscription, userId);
      if (saved) {
        isSubscribedRef.current = true;
        console.info('[Push] ✅ Push-Benachrichtigungen aktiviert');
        return true;
      }

      return false;
    } catch (err) {
      console.error('[Push] Fehler beim Aktivieren:', err);
      return false;
    }
  }, [isSupported, userId]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported || !userId) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Aus DB entfernen
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('app_name', 'lager')
          .eq('subscription->>endpoint', endpoint);
      }

      isSubscribedRef.current = false;
      console.info('[Push] Push-Benachrichtigungen deaktiviert');
    } catch (err) {
      console.error('[Push] Fehler beim Deaktivieren:', err);
    }
  }, [isSupported, userId]);

  return {
    isSupported,
    permission: permissionRef.current,
    requestPermission,
    unsubscribe,
    isSubscribed: isSubscribedRef.current,
  };
}

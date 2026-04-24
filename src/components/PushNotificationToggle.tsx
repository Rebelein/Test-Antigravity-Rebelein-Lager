import React, { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationToggleProps {
  userId: string | null;
  /** Kompakter Modus (nur Icon-Button, z.B. für Header/Settings) */
  compact?: boolean;
}

/**
 * Toggle-Komponente für Web Push Benachrichtigungen.
 * Kann in der Settings-Seite oder im Header der LagerApp eingebunden werden.
 */
export function PushNotificationToggle({ userId, compact = false }: PushNotificationToggleProps) {
  const { isSupported, permission, requestPermission, unsubscribe, isSubscribed } =
    usePushNotifications(userId);

  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(isSubscribed);
  const [currentPermission, setCurrentPermission] = useState(permission);

  // Sync State
  useEffect(() => {
    setSubscribed(isSubscribed);
    setCurrentPermission(permission);
  }, [isSubscribed, permission]);

  if (!isSupported) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BellOff className="h-4 w-4" />
        <span>Push nicht unterstützt</span>
      </div>
    );
  }

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (subscribed) {
        await unsubscribe();
        setSubscribed(false);
      } else {
        if (currentPermission === 'denied') {
          // Browser-Hinweis anzeigen
          alert(
            'Push-Benachrichtigungen sind in deinem Browser blockiert.\n\n' +
            'Bitte erlaube sie in den Browser-Einstellungen:\n' +
            'Klicke auf das Schloss-Symbol in der Adressleiste → Benachrichtigungen → Erlauben'
          );
          return;
        }
        const success = await requestPermission();
        setSubscribed(success);
        setCurrentPermission(Notification.permission);
      }
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        title={subscribed ? 'Push-Benachrichtigungen deaktivieren' : 'Push-Benachrichtigungen aktivieren'}
        className={[
          'relative flex items-center justify-center rounded-lg p-2 transition-all duration-200',
          subscribed
            ? 'text-blue-400 hover:bg-blue-500/10'
            : 'text-muted-foreground hover:bg-slate-700/50 hover:text-slate-200',
          loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : subscribed ? (
          <>
            <BellRing className="h-5 w-5" />
            {/* Aktiv-Indikator Dot */}
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blue-400 ring-2 ring-slate-900" />
          </>
        ) : (
          <Bell className="h-5 w-5" />
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div
          className={[
            'flex h-10 w-10 items-center justify-center rounded-lg',
            subscribed ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50 text-muted-foreground',
          ].join(' ')}
        >
          {subscribed ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-200">Push-Benachrichtigungen</p>
          <p className="text-xs text-muted-foreground">
            {currentPermission === 'denied'
              ? 'In Browser-Einstellungen blockiert'
              : subscribed
              ? 'Aktiv – du wirst benachrichtigt'
              : 'Deaktiviert'}
          </p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={loading || currentPermission === 'denied'}
        className={[
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out focus:outline-none',
          subscribed ? 'bg-blue-500' : 'bg-slate-600',
          loading || currentPermission === 'denied' ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0',
            'transition duration-200 ease-in-out',
            subscribed ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        >
          {loading && (
            <Loader2 className="h-3 w-3 animate-spin absolute top-1 left-1 text-muted-foreground" />
          )}
        </span>
      </button>
    </div>
  );
}

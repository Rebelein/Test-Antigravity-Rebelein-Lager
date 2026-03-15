import { supabase } from '@/supabaseClient';

/**
 * Sendet eine Push-Benachrichtigung über die Supabase Edge Function.
 * Feuert-und-vergiss – Fehler werden geloggt aber nicht weiter geworfen,
 * damit der eigentliche App-Flow nie durch Push-Fehler blockiert wird.
 */
export async function sendPush(payload: {
  /** 'lager' | 'task' | undefined (= alle) */
  targetApp?: 'lager' | 'task';
  /** UUID des Users der NICHT benachrichtigt werden soll (z.B. Sender) */
  excludeUserId?: string;
  /** UUID eines bestimmten Ziel-Users */
  targetUserId?: string;
  title: string;
  body: string;
  /** Relative URL die beim Klick geöffnet wird, z.B. '/commissions' */
  url?: string;
  /** Tag für Deduplizierung (gleicher Tag = ersetzt vorherige Meldung) */
  tag?: string;
}): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-push', { body: payload });
    if (error) {
      console.warn('[Push] Edge Function Fehler:', error.message);
    }
  } catch (err) {
    // Nie den App-Flow unterbrechen
    console.warn('[Push] Fehler beim Senden:', err);
  }
}

// ----------------------------------------------------------------
// Vordefinierte Push-Nachrichten für die LagerApp
// ----------------------------------------------------------------

export const LagerPush = {
  commissionReady: (name: string, senderUserId: string) =>
    sendPush({
      targetApp: 'lager',
      excludeUserId: senderUserId,
      title: '✅ Kommission fertig',
      body: `„${name}" ist abholbereit im Lager.`,
      url: '/commissions',
      tag: 'commission-ready',
    }),

  commissionWithdrawn: (name: string, senderUserId: string) =>
    sendPush({
      targetApp: 'lager',
      excludeUserId: senderUserId,
      title: '📦 Abholung bestätigt',
      body: `„${name}" wurde entnommen.`,
      url: '/commissions',
      tag: 'commission-withdrawn',
    }),

  commissionReturnPending: (name: string, senderUserId: string) =>
    sendPush({
      targetApp: 'lager',
      excludeUserId: senderUserId,
      title: '↩️ Storno beantragt',
      body: `Für „${name}" wurde ein Storno beauftragt.`,
      url: '/commissions',
      tag: 'commission-return',
    }),

  commissionReturnReady: (name: string, senderUserId: string) =>
    sendPush({
      targetApp: 'lager',
      excludeUserId: senderUserId,
      title: '📤 Retoure bereit',
      body: `„${name}" liegt im Abholregal.`,
      url: '/commissions',
      tag: 'commission-return-ready',
    }),

  machineDefect: (machineName: string, senderUserId: string) =>
    sendPush({
      targetApp: 'lager',
      excludeUserId: senderUserId,
      title: '🔧 Maschine defekt',
      body: `„${machineName}" wurde als defekt gemeldet.`,
      url: '/machines',
      tag: 'machine-defect',
    }),

  keyCheckedOut: (keyName: string, holderName: string, senderUserId: string) =>
    sendPush({
      targetApp: 'lager',
      excludeUserId: senderUserId,
      title: '🔑 Schlüssel entnommen',
      body: `„${keyName}" wurde von ${holderName} entnommen.`,
      url: '/keys',
      tag: 'key-checkout',
    }),
};

// ----------------------------------------------------------------
// Vordefinierte Push-Nachrichten für die Task App (SHK Connect)
// Werden aus der Task App direkt aufgerufen, aber zur Vollständigkeit
// auch hier definiert.
// ----------------------------------------------------------------

export const TaskPush = {
  newMessage: (channelName: string, senderName: string, senderUserId: string) =>
    sendPush({
      targetApp: 'task',
      excludeUserId: senderUserId,
      title: `💬 #${channelName}`,
      body: `${senderName}: Neue Nachricht`,
      url: '/',
      tag: `channel-message-${channelName}`,
    }),

  newTask: (taskTitle: string, creatorUserId: string) =>
    sendPush({
      targetApp: 'task',
      excludeUserId: creatorUserId,
      title: '📋 Neue Aufgabe',
      body: `„${taskTitle}" wurde erstellt.`,
      url: '/',
      tag: 'new-task',
    }),
};

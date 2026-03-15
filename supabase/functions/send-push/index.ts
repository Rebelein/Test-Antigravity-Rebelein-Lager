// @ts-nocheck
// Supabase Edge Function: send-push
// Sendet Web Push Benachrichtigungen via VAPID an registrierte Geräte.
// Kann von beiden Apps (LagerApp + TaskApp) genutzt werden.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// VAPID-basierte Web Push Implementierung (kein externer Service nötig)
// Implementiert den RFC 8030 / RFC 8292 Standard direkt in Deno

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ---- Hilfsfunktionen für VAPID / Web Push ----

function base64UrlDecode(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  const binary = atob(padded);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function createJWT(audience: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 Stunden gültig
    sub: "mailto:info@rebelein.de",
  };

  const encodedHeader = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKeyBytes = base64UrlDecode(VAPID_PRIVATE_KEY);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    // VAPID private key aus raw bytes in PKCS8 umwandeln
    createPKCS8FromRaw(privateKeyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

// Konvertiert einen raw 32-Byte ECDSA Private Key in PKCS8 DER Format
function createPKCS8FromRaw(rawKey: Uint8Array): ArrayBuffer {
  // PKCS#8 Header für P-256 ECDSA
  const header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06,
    0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
    0x01, 0x04, 0x20,
  ]);
  const result = new Uint8Array(header.length + rawKey.length);
  result.set(header);
  result.set(rawKey, header.length);
  return result.buffer;
}

async function sendWebPush(
  subscription: PushSubscription,
  payload: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const jwt = await createJWT(audience);
    const vapidHeader = `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`;

    // Payload verschlüsseln (RFC 8291: AES-GCM)
    const encryptedPayload = await encryptPayload(
      payload,
      subscription.keys.p256dh,
      subscription.keys.auth
    );

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Authorization": vapidHeader,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
      },
      body: encryptedPayload,
    });

    if (response.status === 201 || response.status === 200) {
      return { success: true };
    } else if (response.status === 404 || response.status === 410) {
      // Subscription abgelaufen / nicht mehr gültig
      return { success: false, error: "gone" };
    } else {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// AES-128-GCM Verschlüsselung für Web Push Payload (RFC 8291)
async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);

  const clientPublicKey = base64UrlDecode(p256dhBase64);
  const authSecret = base64UrlDecode(authBase64);

  // Server Ephemeral Key Pair generieren
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const serverPublicKeyRaw = await crypto.subtle.exportKey(
    "raw",
    serverKeyPair.publicKey
  );

  // Client Public Key importieren
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Shared Secret ableiten (ECDH)
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientKey },
    serverKeyPair.privateKey,
    256
  );

  // Salt generieren
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF für Verschlüsselungsschlüssel
  const ikm = await hkdf(
    sharedSecret,
    authSecret,
    buildInfo("WebPush: info\0", clientPublicKey, new Uint8Array(serverPublicKeyRaw)),
    32
  );

  const contentEncryptionKey = await hkdf(
    new Uint8Array(ikm),
    salt,
    encoder.encode("Content-Encoding: aes128gcm\0"),
    16
  );

  const nonce = await hkdf(
    new Uint8Array(ikm),
    salt,
    encoder.encode("Content-Encoding: nonce\0"),
    12
  );

  // AES-GCM Schlüssel importieren
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Payload mit Padding verschlüsseln
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 0x02; // Delimiter

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    paddedPayload
  );

  // aes128gcm Header zusammenbauen (RFC 8291 §4)
  const header = new Uint8Array(21 + serverPublicKeyRaw.byteLength);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false); // record size
  header[20] = serverPublicKeyRaw.byteLength;
  header.set(new Uint8Array(serverPublicKeyRaw), 21);

  const result = new Uint8Array(header.byteLength + encrypted.byteLength);
  result.set(header);
  result.set(new Uint8Array(encrypted), header.byteLength);
  return result.buffer;
}

function buildInfo(
  prefix: string,
  clientKey: Uint8Array,
  serverKey: Uint8Array
): Uint8Array {
  const encoder = new TextEncoder();
  const prefixBytes = encoder.encode(prefix);
  const result = new Uint8Array(
    prefixBytes.length + 1 + 2 + clientKey.length + 2 + serverKey.length
  );
  let offset = 0;
  result.set(prefixBytes, offset);
  offset += prefixBytes.length;
  result[offset++] = 0x00;
  new DataView(result.buffer).setUint16(offset, clientKey.length, false);
  offset += 2;
  result.set(clientKey, offset);
  offset += clientKey.length;
  new DataView(result.buffer).setUint16(offset, serverKey.length, false);
  offset += 2;
  result.set(serverKey, offset);
  return result;
}

async function hkdf(
  ikm: Uint8Array | ArrayBuffer,
  salt: Uint8Array | ArrayBuffer,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const ikmKey = await crypto.subtle.importKey(
    "raw",
    ikm,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    ikmKey,
    length * 8
  );
  return new Uint8Array(bits);
}

// ---- Haupt-Handler ----

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushPayload {
  // Zielgruppe: bestimmter User, alle User einer App, oder alle
  targetUserId?: string;   // Nur an einen bestimmten User
  targetApp?: string;      // 'lager' | 'task' | undefined (alle)
  excludeUserId?: string;  // Diesen User ausschließen (z.B. Sender)
  // Benachrichtigungsinhalt
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;            // URL die beim Klick geöffnet wird
  tag?: string;            // Für Gruppierung/Deduplizierung
  data?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const pushPayload: PushPayload = await req.json();

    if (!pushPayload.title || !pushPayload.body) {
      return new Response(
        JSON.stringify({ error: "title und body sind Pflichtfelder" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Supabase Admin Client (umgeht RLS für Server-side Reads)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Subscriptions aus DB laden
    let query = supabase.from("push_subscriptions").select("*");

    if (pushPayload.targetUserId) {
      query = query.eq("user_id", pushPayload.targetUserId);
    }
    if (pushPayload.targetApp) {
      query = query.eq("app_name", pushPayload.targetApp);
    }
    if (pushPayload.excludeUserId) {
      query = query.neq("user_id", pushPayload.excludeUserId);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error("DB Error:", error);
      return new Response(
        JSON.stringify({ error: "Datenbankfehler beim Laden der Subscriptions" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "Keine Subscriptions gefunden" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Notification Payload aufbauen
    const notificationPayload = JSON.stringify({
      title: pushPayload.title,
      body: pushPayload.body,
      icon: pushPayload.icon || "/logo.png",
      badge: pushPayload.badge || "/badge.png",
      url: pushPayload.url || "/",
      tag: pushPayload.tag,
      data: pushPayload.data || {},
    });

    // Push-Benachrichtigungen senden
    let sent = 0;
    let failed = 0;
    const expiredIds: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const result = await sendWebPush(sub.subscription, notificationPayload);
        if (result.success) {
          sent++;
        } else {
          failed++;
          if (result.error === "gone") {
            // Abgelaufene Subscription für spätere Bereinigung merken
            expiredIds.push(sub.id);
          }
          console.error(`Push fehlgeschlagen für ${sub.id}:`, result.error);
        }
      })
    );

    // Abgelaufene Subscriptions bereinigen
    if (expiredIds.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
      console.log(`${expiredIds.length} abgelaufene Subscriptions bereinigt`);
    }

    return new Response(
      JSON.stringify({ sent, failed, expired: expiredIds.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unerwarteter Fehler:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

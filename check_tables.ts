
import { createClient } from '@supabase/supabase-js';

// Credentials aus supabaseClient.ts
const supabaseUrl = 'https://ebjxpgfggygziuczdyik.supabase.co';
// Verwende den Key aus der Datei (sieht nach Service Role oder Anon aus - wir versuchen es damit)
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVianhwZ2ZnZ3lneml1Y3pkeWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NDg5MCwiZXhwIjoyMDc5MTYwODkwfQ.q_ZVQDDgfAUpqqgDR3CyqAZ6IPQH1e1VekTwYCN1ctA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log("Verbinde mit Supabase...");

    // Versuche information_schema abzufragen (erfordert oft Service Role, Key könnte einer sein)
    const { data, error } = await supabase
        .from('commissions')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Verbindungstest fehlgeschlagen:", error.message);
        // Fallback: Wenn wir information_schema nicht lesen dürfen, versuchen wir RPC oder Listen bekannter Tabellen
    } else {
        console.log("Verbindung OK.");
    }

    // Workaround: Da wir vielleicht keinen direkten Zugriff auf information_schema haben via Client SDK (oft blockiert),
    // versuchen wir eine Liste von erwarteten Tabellen zu "pingen".

    const tablesToCheck = [
        'articles',
        'categories',
        'commissions',
        'commission_items',
        'commission_events',
        'machines',
        'machine_logs',
        'orders',
        'suppliers',
        'user_profiles',
        'app_settings',
        'warehouses',
        'warehouse_stock'
    ];

    console.log("\nPrüfe Tabellen-Existenz:");

    for (const table of tablesToCheck) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) {
            console.log(`[FEHLT/ERROR] ${table}: ${error.message}`);
        } else {
            console.log(`[OK] ${table} (Anzahl: ${count})`);
        }
    }
}

checkTables();

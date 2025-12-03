
import { createClient } from '@supabase/supabase-js';

// Helper to safely access environment variables in different build environments (Vite vs Node)
const getEnv = (key: string) => {
  // 1. Check Vite (import.meta.env)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  // 2. Check Node/Webpack (process.env)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
};

// Fallback values for local development or if env vars are missing
const DEFAULT_URL = 'https://ebjxpgfggygziuczdyik.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVianhwZ2ZnZ3lneml1Y3pkeWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NDg5MCwiZXhwIjoyMDc5MTYwODkwfQ.q_ZVQDDgfAUpqqgDR3CyqAZ6IPQH1e1VekTwYCN1ctA';

// CHANGE: Use ANON_KEY env vars for client-side security
const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || DEFAULT_URL;
const supabaseKey = getEnv('SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_ANON_KEY') || DEFAULT_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true, 
    autoRefreshToken: true, 
    detectSessionInUrl: true, 
  }
});

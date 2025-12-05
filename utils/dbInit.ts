import { supabase } from '../supabaseClient';

export const initializeDatabase = async (silent: boolean = false) => {
  try {
    const { error } = await supabase.rpc('exec_sql', { query: MANUAL_SETUP_SQL });
    if (error) {
      if (silent) return;
      // Fehlercode 42883 bedeutet "function does not exist"
      if (error.code === '42883' || (error.message && error.message.includes('does not exist'))) {
        throw new Error("Die Funktion 'exec_sql' fehlt. Bitte SQL manuell ausführen.");
      }
      throw error;
    }
  } catch (err) {
    if (!silent) throw err;
  }
};

/**
 * Dieser SQL-Block ist für die MANUELLE Ausführung im Supabase SQL Editor gedacht,
 * falls die automatische Einrichtung fehlschlägt.
 */
export const MANUAL_SETUP_SQL = `
-- 0. Helper Funktion erstellen (Essentiell für Auto-Updates)
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
END;
$$;

-- 1. Tabellen erstellen (Basis-Struktur)
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('Main', 'Vehicle', 'Site')),
  location TEXT,
  items_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  customer_number TEXT,
  contact_email TEXT,
  website TEXT,
  csv_format TEXT, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'worker',
  avatar_url TEXT,
  email TEXT,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  manufacturer_skus JSONB DEFAULT '[]'::jsonb, 
  stock INTEGER DEFAULT 0,
  target_stock INTEGER DEFAULT 0, 
  location TEXT,
  category TEXT,
  price NUMERIC,
  supplier TEXT,
  image_url TEXT,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ean TEXT,
  supplier_sku TEXT,
  product_url TEXT,
  on_order_date DATE, 
  last_counted_at TIMESTAMP WITH TIME ZONE, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.article_suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_sku TEXT,
  url TEXT,
  is_preferred BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(article_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, 
  amount INTEGER NOT NULL,
  type TEXT, 
  reference TEXT, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT CHECK (status IN ('Available', 'Rented', 'In Repair')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  external_borrower TEXT, 
  next_maintenance DATE,
  image_url TEXT,
  notes TEXT, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.machine_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT, 
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.machine_reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier TEXT,
  date DATE,
  item_count INTEGER,
  status TEXT CHECK (status IN ('Draft', 'Ordered', 'PartiallyReceived', 'Received', 'ReadyForPickup')),
  total NUMERIC,
  commission_number TEXT,
  supplier_order_number TEXT,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  quantity_ordered INTEGER NOT NULL DEFAULT 0,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  -- Custom columns added via migration below
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT, 
  name TEXT, 
  notes TEXT,
  -- Constraint updated dynamically in block 2
  status TEXT, 
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_order_number TEXT,
  is_processed BOOLEAN DEFAULT false, 
  office_notes TEXT, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  needs_label BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.commission_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  commission_id UUID REFERENCES public.commissions(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('Stock', 'External')),
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  custom_name TEXT, 
  external_reference TEXT,
  amount INTEGER DEFAULT 1,
  is_picked BOOLEAN DEFAULT false,
  attachment_data TEXT,
  is_backorder BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.commission_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  commission_id UUID REFERENCES public.commissions(id) ON DELETE SET NULL,
  commission_name TEXT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.order_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. SCHEMA MIGRATION (Updates)
DO $$
BEGIN
    -- Update Commission Status Constraint to include Returns
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='commissions_status_check' AND table_name='commissions') THEN
         ALTER TABLE public.commissions DROP CONSTRAINT commissions_status_check;
    END IF;
    
    ALTER TABLE public.commissions ADD CONSTRAINT commissions_status_check 
    CHECK (status IN ('Draft', 'Preparing', 'Ready', 'Withdrawn', 'ReturnPending', 'ReturnReady', 'ReturnComplete'));

    -- Add Custom Columns to Order Items (Manual Orders)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='custom_name') THEN
        ALTER TABLE public.order_items ADD COLUMN custom_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='custom_sku') THEN
        ALTER TABLE public.order_items ADD COLUMN custom_sku TEXT;
    END IF;

    -- Ensure Profile Columns for Warehouse Preferences exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='primary_warehouse_id') THEN
        ALTER TABLE public.profiles ADD COLUMN primary_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='secondary_warehouse_id') THEN
        ALTER TABLE public.profiles ADD COLUMN secondary_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='collapsed_categories') THEN
        ALTER TABLE public.profiles ADD COLUMN collapsed_categories TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='has_seen_tour') THEN
        ALTER TABLE public.profiles ADD COLUMN has_seen_tour BOOLEAN DEFAULT false;
    END IF;

    -- Update Machines Columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='machines' AND column_name='assigned_to' AND data_type='text') THEN
         UPDATE public.machines SET assigned_to = NULL WHERE assigned_to = '';
         ALTER TABLE public.machines ALTER COLUMN assigned_to TYPE UUID USING assigned_to::uuid;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='machines_assigned_to_fkey') THEN
         ALTER TABLE public.machines ADD CONSTRAINT machines_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='machines' AND column_name='external_borrower') THEN
        ALTER TABLE public.machines ADD COLUMN external_borrower TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='machines' AND column_name='notes') THEN
        ALTER TABLE public.machines ADD COLUMN notes TEXT;
    END IF;
    
    -- Update Articles/Suppliers/Commissions Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='manufacturer_skus') THEN
        ALTER TABLE public.articles ADD COLUMN manufacturer_skus JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='article_suppliers' AND column_name='url') THEN
        ALTER TABLE public.article_suppliers ADD COLUMN url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='articles' AND column_name='last_counted_at') THEN
        ALTER TABLE public.articles ADD COLUMN last_counted_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commissions' AND column_name='deleted_at') THEN
        ALTER TABLE public.commissions ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commissions' AND column_name='needs_label') THEN
        ALTER TABLE public.commissions ADD COLUMN needs_label BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commissions' AND column_name='supplier_id') THEN
        ALTER TABLE public.commissions ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commissions' AND column_name='supplier_order_number') THEN
        ALTER TABLE public.commissions ADD COLUMN supplier_order_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commissions' AND column_name='is_processed') THEN
        ALTER TABLE public.commissions ADD COLUMN is_processed BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commissions' AND column_name='office_notes') THEN
        ALTER TABLE public.commissions ADD COLUMN office_notes TEXT;
    END IF;
    
    -- Add Attachment Column to Commission Items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commission_items' AND column_name='attachment_data') THEN
        ALTER TABLE public.commission_items ADD COLUMN attachment_data TEXT;
    END IF;
    
    -- Add Backorder/Notes to Commission Items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commission_items' AND column_name='is_backorder') THEN
        ALTER TABLE public.commission_items ADD COLUMN is_backorder BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='commission_items' AND column_name='notes') THEN
        ALTER TABLE public.commission_items ADD COLUMN notes TEXT;
    END IF;

    -- Enable Realtime Replication explicitly
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'machines') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE machines;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'commissions') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE commissions;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'commission_events') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE commission_events;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'order_events') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE order_events;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'articles') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE articles;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'machine_events') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE machine_events;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END
$$;
`;
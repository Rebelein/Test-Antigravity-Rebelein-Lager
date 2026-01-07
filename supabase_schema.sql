-- ============================================================================
-- REBELEIN LAGERAPP - DATABASE SCHEMA
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. PROFILES (Users)
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT CHECK (role IN ('admin', 'worker')) DEFAULT 'worker',
    avatar_url TEXT,
    primary_warehouse_id UUID, -- Preference: Main Warehouse
    secondary_warehouse_id UUID, -- Preference: Vehicle/Site
    collapsed_categories TEXT[] DEFAULT '{}', -- UI Preference
    has_seen_tour BOOLEAN DEFAULT FALSE, -- Onboarding Status
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 2. WAREHOUSES
-- ----------------------------------------------------------------------------
CREATE TABLE public.warehouses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('Main', 'Vehicle', 'Site')) NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Warehouses
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Warehouses are viewable by everyone." ON public.warehouses FOR SELECT USING (true);
CREATE POLICY "Admins can insert warehouses." ON public.warehouses FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update warehouses." ON public.warehouses FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ----------------------------------------------------------------------------
-- 3. ARTICLES (Master Data)
-- ----------------------------------------------------------------------------
CREATE TABLE public.articles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT, -- Primary SKU
    manufacturer_skus JSONB DEFAULT '[]', -- List of {sku, isPreferred}
    stock INTEGER DEFAULT 0,
    target_stock INTEGER DEFAULT 0,
    location TEXT,
    category TEXT,
    price DECIMAL(10, 2),
    supplier TEXT, -- Legacy/Primary Supplier Name
    supplier_sku TEXT, -- Legacy/Primary Supplier SKU
    image TEXT,
    product_url TEXT,
    ean TEXT,
    on_order_date TIMESTAMPTZ, -- If set, item is ordered
    last_counted_at TIMESTAMPTZ, -- For Stocktaking/Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Articles
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Articles are viewable by everyone." ON public.articles FOR SELECT USING (true);
CREATE POLICY "Authenticated users can update articles." ON public.articles FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert articles." ON public.articles FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 4. SUPPLIERS
-- ----------------------------------------------------------------------------
CREATE TABLE public.suppliers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    customer_number TEXT,
    contact_email TEXT,
    website TEXT,
    csv_format TEXT, -- Template for CSV export
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suppliers are viewable by everyone." ON public.suppliers FOR SELECT USING (true);
CREATE POLICY "Admins can manage suppliers." ON public.suppliers FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ----------------------------------------------------------------------------
-- 5. ARTICLE SUPPLIERS (Many-to-Many)
-- ----------------------------------------------------------------------------
CREATE TABLE public.article_suppliers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    supplier_sku TEXT,
    url TEXT,
    is_preferred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(article_id, supplier_id)
);

-- RLS Policies for Article Suppliers
ALTER TABLE public.article_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Article Suppliers are viewable by everyone." ON public.article_suppliers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage article suppliers." ON public.article_suppliers FOR ALL USING (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 6. MACHINES (Tools)
-- ----------------------------------------------------------------------------
CREATE TABLE public.machines (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT CHECK (status IN ('Available', 'Rented', 'In Repair')) DEFAULT 'Available',
    assigned_to UUID REFERENCES public.profiles(id), -- Internal User
    external_borrower TEXT, -- External Name
    next_maintenance DATE,
    image TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Machines
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Machines are viewable by everyone." ON public.machines FOR SELECT USING (true);
CREATE POLICY "Authenticated users can update machines." ON public.machines FOR UPDATE USING (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 7. MACHINE EVENTS (Log)
-- ----------------------------------------------------------------------------
CREATE TABLE public.machine_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL, -- 'rented', 'returned', 'defect', etc.
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Machine Events
ALTER TABLE public.machine_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Machine events are viewable by everyone." ON public.machine_events FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert events." ON public.machine_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 8. MACHINE RESERVATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE public.machine_reservations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    machine_id UUID REFERENCES public.machines(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Machine Reservations
ALTER TABLE public.machine_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reservations are viewable by everyone." ON public.machine_reservations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage reservations." ON public.machine_reservations FOR ALL USING (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 9. COMMISSIONS (Projects)
-- ----------------------------------------------------------------------------
CREATE TABLE public.commissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_number TEXT, -- Project Number
    name TEXT NOT NULL, -- Project Name
    notes TEXT,
    status TEXT CHECK (status IN ('Draft', 'Preparing', 'Ready', 'Withdrawn', 'ReturnPending', 'ReturnReady', 'ReturnComplete', 'Missing')) DEFAULT 'Draft',
    warehouse_id UUID REFERENCES public.warehouses(id), -- Usually Main Warehouse
    needs_label BOOLEAN DEFAULT FALSE, -- Print Queue Flag
    supplier_id UUID REFERENCES public.suppliers(id), -- Optional: If direct order
    supplier_order_number TEXT,
    is_processed BOOLEAN DEFAULT FALSE, -- Office status
    office_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    withdrawn_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ -- Trash bin logic (soft delete)
);

-- RLS Policies for Commissions
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commissions are viewable by everyone." ON public.commissions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage commissions." ON public.commissions FOR ALL USING (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 10. COMMISSION ITEMS
-- ----------------------------------------------------------------------------
CREATE TABLE public.commission_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    commission_id UUID REFERENCES public.commissions(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('Stock', 'External')) NOT NULL,
    article_id UUID REFERENCES public.articles(id), -- If Stock
    custom_name TEXT, -- If External
    external_reference TEXT, -- Delivery Note No. etc.
    attachment_data TEXT, -- Base64 (avoid large files if possible, use storage buckets in prod)
    amount INTEGER DEFAULT 1,
    is_picked BOOLEAN DEFAULT FALSE,
    is_backorder BOOLEAN DEFAULT FALSE, -- Status: Backorder
    notes TEXT, -- Item specific notes
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Commission Items
ALTER TABLE public.commission_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commission items are viewable by everyone." ON public.commission_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage commission items." ON public.commission_items FOR ALL USING (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 11. COMMISSION LOGS (History)
-- ----------------------------------------------------------------------------
CREATE TABLE public.commission_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    commission_id UUID REFERENCES public.commissions(id) ON DELETE CASCADE,
    commission_name TEXT, -- Snapshot in case commission is deleted
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL, -- 'created', 'status_change', 'item_add', etc.
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Commission Logs
ALTER TABLE public.commission_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commission logs are viewable by everyone." ON public.commission_logs FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert logs." ON public.commission_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 12. ORDERS (Procurement)
-- ----------------------------------------------------------------------------
CREATE TABLE public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    supplier_id UUID REFERENCES public.suppliers(id),
    warehouse_id UUID REFERENCES public.warehouses(id),
    status TEXT CHECK (status IN ('Draft', 'Ordered', 'PartiallyReceived', 'Received', 'ReadyForPickup')) DEFAULT 'Draft',
    order_date DATE DEFAULT CURRENT_DATE,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    commission_number TEXT,
    supplier_order_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orders are viewable by everyone." ON public.orders FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage orders." ON public.orders FOR ALL USING (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 13. ORDER ITEMS
-- ----------------------------------------------------------------------------
CREATE TABLE public.order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    article_id UUID REFERENCES public.articles(id),
    custom_name TEXT, -- For manual items
    custom_sku TEXT,
    quantity_ordered INTEGER NOT NULL,
    quantity_received INTEGER DEFAULT 0,
    price_per_unit DECIMAL(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Order Items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order items are viewable by everyone." ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage order items." ON public.order_items FOR ALL USING (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 14. REALTIME SUBSCRIPTIONS
-- ----------------------------------------------------------------------------
-- Enable Realtime for critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.machines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.machine_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- ----------------------------------------------------------------------------
-- 15. FUNCTIONS & TRIGGERS (Optional Helpers)
-- ----------------------------------------------------------------------------

-- Function to handle new user signup (automatically create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================================
-- 16. KEY CATEGORIES
-- ============================================================================

CREATE TABLE public.key_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Key Categories
ALTER TABLE public.key_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Key categories are viewable by everyone." ON public.key_categories FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage key categories." ON public.key_categories FOR ALL USING (auth.role() = 'authenticated');


-- ============================================================================
-- 17. KEYS (Schlüsselkasten)
-- ============================================================================

CREATE TABLE public.keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    slot_number INTEGER UNIQUE NOT NULL, -- Platznummer
    name TEXT NOT NULL, -- Bezeichnung
    address TEXT, -- Objektadresse
    status TEXT CHECK (status IN ('Available', 'InUse', 'Lost')) DEFAULT 'Available',
    holder_id UUID REFERENCES public.profiles(id), -- Aktueller Besitzer (falls interner User)
    holder_name TEXT, -- Fallback / manueller Name (falls externer Kunde)
    owner TEXT, -- Eigentümer / Kunde
    notes TEXT,
    category_id UUID REFERENCES public.key_categories(id) ON DELETE SET NULL, -- Kategorie / Farbleitsystem
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies für Keys (Berechtigungen)
ALTER TABLE public.keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Keys are viewable by everyone." ON public.keys FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage keys." ON public.keys FOR ALL USING (auth.role() = 'authenticated');


-- ============================================================================
-- 18. KEY EVENTS (Logbuch / Historie)
-- ============================================================================

CREATE TABLE public.key_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key_id UUID REFERENCES public.keys(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id), -- Der User, der die Aktion durchführt
    action TEXT NOT NULL, -- 'checkout', 'checkin', 'create', 'update', 'delete'
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies für Key Events
ALTER TABLE public.key_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Key events are viewable by everyone." ON public.key_events FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage key events." ON public.key_events FOR ALL USING (auth.role() = 'authenticated');

-- Hinweis: Realtime ist standardmäßig für alle Tabellen aktiv, wenn "supabase_realtime" als FOR ALL TABLES definiert ist.
-- Falls nicht, müssten die folgenden Zeilen einkommentiert werden:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.keys;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.key_events;

-- ============================================================================
-- 19. WORKWEAR MODULE (Arbeitskleidung)
-- ============================================================================

-- 1. Profile Role Enhancement
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='workwear_role') THEN
        ALTER TABLE public.profiles ADD COLUMN workwear_role TEXT CHECK (workwear_role IN ('chef', 'besteller', 'monteur'));
    END IF;
END $$;

-- 2. Workwear Settings (Global Config like Logo)
CREATE TABLE IF NOT EXISTS public.workwear_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workwear_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Settings viewable by everyone" ON public.workwear_settings;
CREATE POLICY "Settings viewable by everyone" ON public.workwear_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins/Chef can update settings" ON public.workwear_settings;
CREATE POLICY "Admins/Chef can update settings" ON public.workwear_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR workwear_role = 'chef'))
);

-- 3. Workwear Templates (Catalog)
CREATE TABLE IF NOT EXISTS public.workwear_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'T-Shirt', 'Hose', 'Jacke', 'Schuhe', etc.
    article_number TEXT,
    price DECIMAL(10, 2) DEFAULT 0,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workwear_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Templates viewable by everyone" ON public.workwear_templates;
CREATE POLICY "Templates viewable by everyone" ON public.workwear_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Chef/Besteller can manage templates" ON public.workwear_templates;
CREATE POLICY "Chef/Besteller can manage templates" ON public.workwear_templates FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR workwear_role IN ('chef', 'besteller')))
);

-- 4. Workwear Budgets
CREATE TABLE IF NOT EXISTS public.workwear_budgets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    budget_limit DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, year)
);

ALTER TABLE public.workwear_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own budget" ON public.workwear_budgets;
CREATE POLICY "Users view own budget" ON public.workwear_budgets FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Chef views all budgets" ON public.workwear_budgets;
CREATE POLICY "Chef views all budgets" ON public.workwear_budgets FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR workwear_role = 'chef'))
);
DROP POLICY IF EXISTS "Chef manages budgets" ON public.workwear_budgets;
CREATE POLICY "Chef manages budgets" ON public.workwear_budgets FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR workwear_role = 'chef'))
);

-- 5. User Sizes
CREATE TABLE IF NOT EXISTS public.user_sizes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- Matches template category
    size_value TEXT NOT NULL, -- 'M', 'L', '42', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category)
);

ALTER TABLE public.user_sizes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own sizes" ON public.user_sizes;
CREATE POLICY "Users manage own sizes" ON public.user_sizes FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Chef/Besteller view sizes" ON public.user_sizes;
CREATE POLICY "Chef/Besteller view sizes" ON public.user_sizes FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR workwear_role IN ('chef', 'besteller')))
);

-- 6. Workwear Orders
CREATE TABLE IF NOT EXISTS public.workwear_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('REQUESTED', 'ORDERED', 'RETURNED', 'COMPLETED')) DEFAULT 'REQUESTED',
    total_amount DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workwear_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own orders" ON public.workwear_orders;
CREATE POLICY "Users view own orders" ON public.workwear_orders FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Chef/Besteller view all orders" ON public.workwear_orders;
CREATE POLICY "Chef/Besteller view all orders" ON public.workwear_orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR workwear_role IN ('chef', 'besteller')))
);
DROP POLICY IF EXISTS "Users can create requests" ON public.workwear_orders;
CREATE POLICY "Users can create requests" ON public.workwear_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Chef/Besteller manage orders" ON public.workwear_orders;
CREATE POLICY "Chef/Besteller manage orders" ON public.workwear_orders FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR workwear_role IN ('chef', 'besteller')))
);

-- 7. Workwear Order Items
CREATE TABLE IF NOT EXISTS public.workwear_order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.workwear_orders(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.workwear_templates(id),
    size TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    price_at_order DECIMAL(10, 2), -- Snapshot price
    use_logo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workwear_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Items viewable per order logic" ON public.workwear_order_items;
CREATE POLICY "Items viewable per order logic" ON public.workwear_order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workwear_orders WHERE id = workwear_order_items.order_id AND (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR workwear_role IN ('chef', 'besteller')))
    ))
);
DROP POLICY IF EXISTS "Users add items to own draft/request" ON public.workwear_order_items;
CREATE POLICY "Users add items to own draft/request" ON public.workwear_order_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.workwear_orders WHERE id = workwear_order_items.order_id AND user_id = auth.uid())
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.workwear_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workwear_order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workwear_budgets;


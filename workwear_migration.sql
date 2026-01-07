-- WORKWEAR MODULE MIGRATION
-- Run this script to add the new tables for the Workwear feature.

-- 1. Profile Role Enhancement
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='workwear_role') THEN
        ALTER TABLE public.profiles ADD COLUMN workwear_role TEXT CHECK (workwear_role IN ('chef', 'besteller', 'monteur'));
    END IF;
END $$;

-- 2. Workwear Settings (Global Config like Logo)
CREATE TABLE IF NOT EXISTS public.workwear_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- FIX: ALLOW DELETION AND UPDATES
-- Run this part to enable delete functionality

-- 1. Orders: Allow Delete and Update for Users (limit to REQUESTED) and Admins
DROP POLICY IF EXISTS "Users can delete own requests" ON public.workwear_orders;
CREATE POLICY "Users can delete own requests" ON public.workwear_orders FOR DELETE USING (
    auth.uid() = user_id AND status = 'REQUESTED'
);

DROP POLICY IF EXISTS "Admins can delete orders" ON public.workwear_orders;
CREATE POLICY "Admins can delete orders" ON public.workwear_orders FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR workwear_role IN ('chef', 'besteller')))
);

DROP POLICY IF EXISTS "Users can update own requests" ON public.workwear_orders;
CREATE POLICY "Users can update own requests" ON public.workwear_orders FOR UPDATE USING (
    auth.uid() = user_id AND status = 'REQUESTED'
);

-- 2. Items: Allow Delete for Users (limit to REQUESTED parent) and Admins
DROP POLICY IF EXISTS "Users can delete own items" ON public.workwear_order_items;
CREATE POLICY "Users can delete own items" ON public.workwear_order_items FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.workwear_orders WHERE id = workwear_order_items.order_id 
        AND user_id = auth.uid() 
        AND status = 'REQUESTED'
    )
);

DROP POLICY IF EXISTS "Admins can delete items" ON public.workwear_order_items;
CREATE POLICY "Admins can delete items" ON public.workwear_order_items FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR workwear_role IN ('chef', 'besteller')))
);

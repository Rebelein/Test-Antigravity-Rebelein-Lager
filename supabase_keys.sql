-- ============================================================================
-- 16. KEYS (Schlüsselkasten)
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Keys
ALTER TABLE public.keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Keys are viewable by everyone." ON public.keys FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage keys." ON public.keys FOR ALL USING (auth.role() = 'authenticated');


-- ============================================================================
-- 17. KEY EVENTS (Log)
-- ============================================================================

CREATE TABLE public.key_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key_id UUID REFERENCES public.keys(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id), -- User performing action
    action TEXT NOT NULL, -- 'checkout', 'checkin', 'create', 'update', 'delete'
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Key Events
ALTER TABLE public.key_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Key events are viewable by everyone." ON public.key_events FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage key events." ON public.key_events FOR ALL USING (auth.role() = 'authenticated');

-- Enable Realtime
-- NOTE: If 'supabase_realtime' is defined as FOR ALL TABLES, these lines will fail and can be ignored.
-- If not, uncomment the lines below:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.keys;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.key_events;

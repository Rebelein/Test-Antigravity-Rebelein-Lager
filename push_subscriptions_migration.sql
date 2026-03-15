-- ============================================================================
-- PUSH SUBSCRIPTIONS
-- Speichert Web Push Subscriptions für beide Apps (LagerApp + TaskApp)
-- Wird von der send-push Edge Function genutzt
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    app_name TEXT NOT NULL CHECK (app_name IN ('lager', 'task')),
    -- Die vollständige PushSubscription-Struktur (endpoint + keys)
    subscription JSONB NOT NULL,
    -- Hilfreich für Debugging / Analytics
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eindeutiger Index auf User + App + Endpoint (Expression-Index, muss separat stehen)
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_unique_endpoint
    ON public.push_subscriptions (user_id, app_name, (subscription->>'endpoint'));

-- RLS aktivieren
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- User kann nur eigene Subscriptions lesen/verwalten
CREATE POLICY "Users manage own push subscriptions"
    ON public.push_subscriptions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service Role (Edge Function) kann alle lesen - über service_role Key
-- Kein separates Policy nötig, da service_role RLS umgeht

-- Auto-Update Timestamp Trigger
CREATE OR REPLACE FUNCTION public.update_push_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_push_subscription_timestamp();

-- ============================================================================
-- PUSH NOTIFICATION LOG (optional, für Debugging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_notification_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    triggered_by_user UUID REFERENCES auth.users(id),
    app_name TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    target_user_id UUID,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;

-- Admins können Logs sehen (LagerApp)
CREATE POLICY "Admins can view push logs"
    ON public.push_notification_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

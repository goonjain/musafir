-- =============================================================================
-- RAAHI — JAIPUR CROWD INTELLIGENCE SCHEMA
-- Migration: 20261011_crowd_schema.sql
-- Description: Sets up canonical destinations, crowd reports, verified observations,
--              events, RLS policies, indexes, and anti-abuse safeguards.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CANONICAL DESTINATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.destinations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    hindi_name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    base_crowd_score INTEGER NOT NULL CHECK (base_crowd_score BETWEEN 5 AND 95),
    safe_hourly_capacity INTEGER NOT NULL DEFAULT 1000,
    entry_fee_inr INTEGER NOT NULL DEFAULT 0,
    is_gem BOOLEAN NOT NULL DEFAULT FALSE,
    tags TEXT[] NOT NULL DEFAULT '{}',
    best_hours TEXT NOT NULL,
    peak_hours TEXT NOT NULL,
    alternatives TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.destinations IS 'Canonical registry of Jaipur tourist destinations and baseline capacities.';

-- -----------------------------------------------------------------------------
-- 2. CROWD REPORTS TABLE (Tourist Submissions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crowd_reports (
    id TEXT PRIMARY KEY DEFAULT ('rep-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12)),
    destination_id TEXT NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
    status_level TEXT NOT NULL CHECK (status_level IN ('Quiet', 'Moderate', 'Busy')),
    tip_text VARCHAR(160),
    user_alias VARCHAR(50) DEFAULT 'Traveller',
    user_session_hash VARCHAR(64) NOT NULL,
    moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'verified', 'rejected')),
    moderation_notes TEXT,
    moderated_by VARCHAR(50),
    moderated_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    client_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crowd_reports_dest_submitted 
    ON public.crowd_reports(destination_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_crowd_reports_moderation 
    ON public.crowd_reports(moderation_status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_crowd_reports_user_session 
    ON public.crowd_reports(user_session_hash, submitted_at DESC);

COMMENT ON TABLE public.crowd_reports IS 'Raw user-submitted crowd observations awaiting moderation.';

-- -----------------------------------------------------------------------------
-- 3. ACCEPTED CROWD OBSERVATIONS TABLE (Verified Ground-Truth)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crowd_observations (
    id TEXT PRIMARY KEY DEFAULT ('obs-' || substr(md5(random()::text || clock_timestamp()::text), 1, 12)),
    destination_id TEXT NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
    crowd_level TEXT NOT NULL CHECK (crowd_level IN ('Quiet', 'Moderate', 'Busy')),
    source_type TEXT NOT NULL CHECK (source_type IN ('community_verified', 'authority_override', 'staff_check')),
    confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0.1 AND 1.0),
    tip_text TEXT,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    related_report_id TEXT REFERENCES public.crowd_reports(id) ON DELETE SET NULL,
    verified_by VARCHAR(50) DEFAULT 'Authority'
);

CREATE INDEX IF NOT EXISTS idx_crowd_obs_dest_active 
    ON public.crowd_observations(destination_id, expires_at DESC) 
    WHERE is_active = TRUE;

COMMENT ON TABLE public.crowd_observations IS 'Accepted on-ground observations that influence the live crowd baseline.';

-- -----------------------------------------------------------------------------
-- 4. JAIPUR LOCAL FESTIVALS & EVENTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    hindi_title TEXT NOT NULL,
    location_name TEXT NOT NULL,
    destination_id TEXT REFERENCES public.destinations(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    crowd_multiplier_pct INTEGER NOT NULL DEFAULT 15 CHECK (crowd_multiplier_pct BETWEEN 0 AND 50),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crowd_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crowd_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "Public read destinations" ON public.destinations;
DROP POLICY IF EXISTS "Public read events" ON public.events;
DROP POLICY IF EXISTS "Public read reports" ON public.crowd_reports;
DROP POLICY IF EXISTS "Public insert reports" ON public.crowd_reports;
DROP POLICY IF EXISTS "Allow update reports" ON public.crowd_reports;
DROP POLICY IF EXISTS "Public read observations" ON public.crowd_observations;
DROP POLICY IF EXISTS "Allow insert observations" ON public.crowd_observations;
DROP POLICY IF EXISTS "Allow update observations" ON public.crowd_observations;

-- Destinations: public read-only
CREATE POLICY "Public read destinations" 
    ON public.destinations FOR SELECT 
    USING (true);

-- Events: public read-only
CREATE POLICY "Public read events" 
    ON public.events FOR SELECT 
    USING (true);

-- Crowd Reports: Anyone can read reports (supports public and admin command center)
CREATE POLICY "Public read reports" 
    ON public.crowd_reports FOR SELECT 
    USING (true);

-- Crowd Reports: Anyone can submit a report with destination check
CREATE POLICY "Public insert reports" 
    ON public.crowd_reports FOR INSERT 
    WITH CHECK (
        char_length(tip_text) <= 160 AND
        destination_id IN (SELECT id FROM public.destinations)
    );

-- Crowd Reports: Allow moderation update
CREATE POLICY "Allow update reports" 
    ON public.crowd_reports FOR UPDATE 
    USING (true)
    WITH CHECK (true);

-- Active Observations: Public read
CREATE POLICY "Public read observations" 
    ON public.crowd_observations FOR SELECT 
    USING (true);

-- Crowd Observations: Allow insert & update
CREATE POLICY "Allow insert observations" 
    ON public.crowd_observations FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow update observations" 
    ON public.crowd_observations FOR UPDATE 
    USING (true);

-- -----------------------------------------------------------------------------
-- 6. CANONICAL JAIPUR SEED DATA
-- -----------------------------------------------------------------------------
INSERT INTO public.destinations (id, name, hindi_name, latitude, longitude, base_crowd_score, safe_hourly_capacity, entry_fee_inr, is_gem, tags, best_hours, peak_hours, alternatives)
VALUES
('amber', 'Amber Fort', 'आमेर किला', 26.9855, 75.8513, 62, 2500, 200, false, ARRAY['heritage', 'photography'], '9:00–11:00 AM', '4:00–7:00 PM', ARRAY['jaigarh', 'panna']),
('jaigarh', 'Jaigarh Fort', 'जयगढ़ किला', 26.9858, 75.8456, 30, 800, 150, true, ARRAY['heritage', 'photography', 'nature'], '10:00 AM–1:00 PM', '3:00–5:00 PM', ARRAY[]::TEXT[]),
('panna', 'Panna Meena Kund', 'पन्ना मीणा कुंड', 26.9859, 75.8580, 18, 300, 0, true, ARRAY['photography', 'heritage'], '8:00 AM–12:00 PM', '5:00–6:00 PM', ARRAY[]::TEXT[]),
('nahargarh', 'Nahargarh Fort', 'नाहरगढ़ किला', 26.9374, 75.8155, 50, 1800, 200, false, ARRAY['heritage', 'nature', 'photography'], '10:00 AM–2:00 PM', '5:00–7:30 PM', ARRAY['jaigarh', 'jalmahal']),
('jalmahal', 'Jal Mahal', 'जल महल', 26.9656, 75.8460, 40, 1500, 0, false, ARRAY['photography', 'nature'], '7:00–9:00 AM', '5:00–7:00 PM', ARRAY['sisodia', 'kanak']),
('kanak', 'Kanak Ghati', 'कनक घाटी', 26.9620, 75.8524, 15, 600, 0, true, ARRAY['nature', 'photography'], '8:00–11:00 AM', '4:00–5:00 PM', ARRAY[]::TEXT[]),
('hawa', 'Hawa Mahal', 'हवा महल', 26.9239, 75.8267, 58, 1600, 50, false, ARRAY['heritage', 'photography', 'shopping'], '8:00–10:00 AM', '11:00 AM–4:00 PM', ARRAY['albert', 'patrika']),
('jantar', 'Jantar Mantar', 'जंतर मंतर', 26.9248, 75.8246, 48, 1200, 50, false, ARRAY['heritage'], '9:00–10:30 AM', '12:00–3:00 PM', ARRAY['citypalace', 'anokhi']),
('citypalace', 'City Palace', 'सिटी पैलेस', 26.9258, 75.8237, 45, 1400, 300, false, ARRAY['heritage', 'photography'], '9:30–11:00 AM', '1:00–4:00 PM', ARRAY[]::TEXT[]),
('albert', 'Albert Hall Museum', 'अल्बर्ट हॉल', 26.9116, 75.8195, 28, 1000, 40, true, ARRAY['heritage', 'photography'], '10:00 AM–1:00 PM', '6:00–8:00 PM', ARRAY[]::TEXT[]),
('patrika', 'Patrika Gate', 'पत्रिका गेट', 26.8398, 75.8052, 25, 700, 0, true, ARRAY['photography'], '7:00–9:00 AM', '4:00–6:00 PM', ARRAY[]::TEXT[]),
('bapu', 'Bapu Bazaar', 'बापू बाज़ार', 26.9198, 75.8242, 55, 3000, 0, false, ARRAY['shopping', 'food'], '11:00 AM–1:00 PM', '5:00–9:00 PM', ARRAY['tripolia', 'sanganer']),
('tripolia', 'Tripolia Bazaar', 'त्रिपोलिया बाज़ार', 26.9245, 75.8214, 30, 1500, 0, true, ARRAY['shopping'], '11:00 AM–2:00 PM', '6:00–8:00 PM', ARRAY[]::TEXT[]),
('anokhi', 'Anokhi Museum', 'अनोखी संग्रहालय', 26.9897, 75.8532, 12, 200, 80, true, ARRAY['heritage', 'shopping'], '10:30 AM–4:00 PM', '—', ARRAY[]::TEXT[]),
('sisodia', 'Sisodia Rani Garden', 'सिसोदिया रानी बाग', 26.8920, 75.8677, 22, 500, 50, true, ARRAY['nature', 'photography', 'heritage'], '9:00 AM–12:00 PM', '4:00–6:00 PM', ARRAY[]::TEXT[]),
('sanganer', 'Sanganer Craft Area', 'सांगानेर', 26.8228, 75.7725, 15, 800, 0, true, ARRAY['shopping', 'photography'], '10:00 AM–3:00 PM', '—', ARRAY[]::TEXT[])
ON CONFLICT (id) DO UPDATE SET
    base_crowd_score = EXCLUDED.base_crowd_score,
    safe_hourly_capacity = EXCLUDED.safe_hourly_capacity,
    alternatives = EXCLUDED.alternatives;

-- Seed Sample Reports & Verified Observations
INSERT INTO public.crowd_reports (id, destination_id, status_level, tip_text, user_alias, user_session_hash, moderation_status, moderated_at, moderated_by, submitted_at)
VALUES
('rep-seed-1', 'panna', 'Quiet', 'Only 5 people here, stunning water reflection!', 'Riya', 'seed-user-1', 'verified', NOW() - INTERVAL '5 minutes', 'DoT Jaipur Officer', NOW() - INTERVAL '6 minutes'),
('rep-seed-2', 'amber', 'Busy', 'Suraj Pol entrance queue ~40 min. Elephant ramp congested.', 'Kabir', 'seed-user-2', 'verified', NOW() - INTERVAL '12 minutes', 'DoT Jaipur Officer', NOW() - INTERVAL '14 minutes'),
('rep-seed-3', 'hawa', 'Moderate', 'Wind View Café rooftop has good seating.', 'Sophie', 'seed-user-3', 'verified', NOW() - INTERVAL '20 minutes', 'DoT Jaipur Officer', NOW() - INTERVAL '25 minutes'),
('rep-seed-4', 'albert', 'Quiet', 'Quiet galleries, AC inside is refreshing.', 'Arjun', 'seed-user-4', 'pending', NULL, NULL, NOW() - INTERVAL '40 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.crowd_observations (id, destination_id, crowd_level, source_type, confidence, tip_text, observed_at, expires_at, verified_by, related_report_id)
VALUES
('obs-seed-1', 'panna', 'Quiet', 'community_verified', 0.90, 'Only 5 people here, stunning water reflection!', NOW() - INTERVAL '6 minutes', NOW() + INTERVAL '84 minutes', 'DoT Jaipur Officer', 'rep-seed-1'),
('obs-seed-2', 'amber', 'Busy', 'community_verified', 0.95, 'Suraj Pol entrance queue ~40 min. Elephant ramp congested.', NOW() - INTERVAL '14 minutes', NOW() + INTERVAL '76 minutes', 'DoT Jaipur Officer', 'rep-seed-2'),
('obs-seed-3', 'hawa', 'Moderate', 'community_verified', 0.85, 'Wind View Café rooftop has good seating.', NOW() - INTERVAL '25 minutes', NOW() + INTERVAL '65 minutes', 'DoT Jaipur Officer', 'rep-seed-3')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, title, hindi_title, location_name, destination_id, start_date, end_date, crowd_multiplier_pct, description)
VALUES
('evt-teej-2026', 'Teej Festival Procession', 'तीज महोत्सव', 'City Palace & Tripolia Bazaar', 'citypalace', '2026-08-15', '2026-08-17', 35, 'Royal palanquin and folk dance procession through Old City gates.'),
('evt-gangaur-2026', 'Gangaur Fair', 'गणगौर मेला', 'Old Walled City', 'hawa', '2026-04-10', '2026-04-12', 40, 'Traditional idol immersion procession along Hawa Mahal and Johari Bazaar.')
ON CONFLICT (id) DO NOTHING;

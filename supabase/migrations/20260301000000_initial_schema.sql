-- =============================================================================
-- Initial Schema: NeighbourhoodWatch
-- Migration: 20260301000000_initial_schema.sql
-- =============================================================================

-- Enable PostGIS for geospatial support
create extension if not exists postgis;

-- =============================================================================
-- TABLE: profiles
-- Extends Supabase auth.users. One row per authenticated user.
-- =============================================================================
create table if not exists public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    avatar_url  text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.profiles is
    'Public profile data for each authenticated user, keyed to auth.users.';

-- Auto-update updated_at on row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

-- =============================================================================
-- TABLE: incident_categories
-- Lookup table for incident types shown on the map.
-- =============================================================================
create table if not exists public.incident_categories (
    id            serial primary key,
    slug          text unique not null,
    label         text not null,
    icon          text,           -- emoji or icon name (e.g. "🔦" or "eye")
    color         text,           -- hex color for map markers, e.g. "#FF5733"
    display_order int not null default 0
);

comment on table public.incident_categories is
    'Lookup table of incident category types with display metadata for the map UI.';

-- =============================================================================
-- TABLE: incidents
-- Core table. Each row is one community-reported incident.
-- =============================================================================
create table if not exists public.incidents (
    id            uuid primary key default gen_random_uuid(),
    reporter_id   uuid references public.profiles(id) on delete set null,
    category_id   int  references public.incident_categories(id),
    title         text not null,
    description   text,
    location      geometry(Point, 4326),   -- PostGIS point; SRID 4326 = WGS 84 (lat/lng)
    location_name text,                    -- human-readable address or landmark
    photo_url     text,
    status        text not null default 'pending'
                      check (status in ('pending', 'approved', 'removed')),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

comment on table public.incidents is
    'Community-reported incidents. Location stored as PostGIS Point (WGS 84).';

comment on column public.incidents.location is
    'PostGIS Point geometry in SRID 4326 (WGS 84). Use ST_MakePoint(lng, lat) to insert.';

comment on column public.incidents.status is
    'Lifecycle state: pending (awaiting moderation), approved (visible on map), removed (hidden).';

-- Spatial index for proximity queries
create index if not exists incidents_location_gist
    on public.incidents using gist (location);

-- Index for filtering by status (common in map queries)
create index if not exists incidents_status_idx
    on public.incidents (status);

-- Index for reporter lookups
create index if not exists incidents_reporter_id_idx
    on public.incidents (reporter_id);

create trigger incidents_set_updated_at
    before update on public.incidents
    for each row execute function public.set_updated_at();

-- =============================================================================
-- TABLE: notifications
-- In-app notifications sent to users about nearby or relevant incidents.
-- =============================================================================
create table if not exists public.notifications (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    incident_id uuid references public.incidents(id) on delete cascade,
    type        text not null default 'nearby_incident',
    read_at     timestamptz,   -- null = unread
    created_at  timestamptz not null default now()
);

comment on table public.notifications is
    'In-app notifications for users. read_at is null while unread.';

comment on column public.notifications.read_at is
    'Timestamp when the user read the notification. NULL means unread.';

-- Index for fetching a user's unread notifications efficiently
create index if not exists notifications_user_id_read_at_idx
    on public.notifications (user_id, read_at);

-- =============================================================================
-- TABLE: user_preferences
-- Per-user settings for alerts and map filtering.
-- =============================================================================
create table if not exists public.user_preferences (
    user_id          uuid primary key references public.profiles(id) on delete cascade,
    alert_radius_km  numeric not null default 2.0,
    notify_email     boolean not null default true,
    notify_in_app    boolean not null default true,
    -- Empty array means "all categories"; populated array restricts alerts to listed slugs
    category_filter  text[]  not null default '{}'
);

comment on table public.user_preferences is
    'Per-user alert and display preferences.';

comment on column public.user_preferences.category_filter is
    'Array of category slugs to filter alerts. Empty array means all categories are included.';

comment on column public.user_preferences.alert_radius_km is
    'Radius in kilometres within which the user wants to receive nearby-incident alerts.';

-- =============================================================================
-- RLS: Enable row-level security on all tables
-- (Policies are defined in 20260301000001_rls_policies.sql)
-- =============================================================================
alter table public.profiles          enable row level security;
alter table public.incident_categories enable row level security;
alter table public.incidents         enable row level security;
alter table public.notifications     enable row level security;
alter table public.user_preferences  enable row level security;

-- =============================================================================
-- SEED DATA: incident_categories
-- =============================================================================
insert into public.incident_categories (slug, label, icon, color, display_order)
values
    ('suspicious-activity', 'Suspicious Activity', '👁️',  '#F59E0B', 1),
    ('break-in',            'Break-In',            '🔓',  '#EF4444', 2),
    ('vandalism',           'Vandalism',           '🖊️',  '#8B5CF6', 3),
    ('traffic-incident',    'Traffic Incident',    '🚗',  '#3B82F6', 4),
    ('noise',               'Noise',               '🔊',  '#10B981', 5),
    ('other',               'Other',               '📌',  '#6B7280', 6)
on conflict (slug) do nothing;

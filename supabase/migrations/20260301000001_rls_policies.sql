-- =============================================================================
-- RLS Policies: NeighbourhoodWatch
-- Migration: 20260301000001_rls_policies.sql
-- Depends on: 20260301000000_initial_schema.sql
-- =============================================================================
-- Conventions used throughout:
--   auth.uid()  — Supabase helper returning the UUID of the authenticated user
--   auth.role() — returns 'authenticated' for logged-in users, 'anon' otherwise
-- =============================================================================


-- =============================================================================
-- profiles
-- - Any authenticated user can read all profiles (needed for incident attribution).
-- - Users can only update their own profile row.
-- - Insert is handled by a trigger on auth.users (see note below).
-- =============================================================================

-- Allow any authenticated user to read all profiles
create policy "profiles: authenticated users can read all"
    on public.profiles
    for select
    to authenticated
    using (true);

-- Allow a user to update only their own profile
create policy "profiles: users can update own profile"
    on public.profiles
    for update
    to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());

-- Allow insert only for the matching auth user (supports manual upsert on sign-up)
create policy "profiles: users can insert own profile"
    on public.profiles
    for insert
    to authenticated
    with check (id = auth.uid());

-- NOTE: A recommended pattern is to create profile rows automatically via a
-- Supabase Database Function triggered on auth.users INSERT. That trigger
-- (handle_new_user) should be added in a future migration.


-- =============================================================================
-- incident_categories
-- - Read-only lookup table; all authenticated users (and anon) can read.
-- - No user-facing insert/update/delete — managed by admins via service role.
-- =============================================================================

create policy "incident_categories: anyone can read"
    on public.incident_categories
    for select
    using (true);   -- allows anon reads (needed for public map pages)


-- =============================================================================
-- incidents
-- - Authenticated users can read approved incidents (public map feed).
-- - A reporter can also read their own pending/removed incidents.
-- - Any authenticated user can insert a new incident (starts as 'pending').
-- - A reporter can update their own incident while it is still 'pending'.
-- - Approved/removed incidents are immutable by reporters (admin/service role only).
-- =============================================================================

-- Read: approved incidents are visible to all authenticated users
create policy "incidents: authenticated users can read approved"
    on public.incidents
    for select
    to authenticated
    using (status = 'approved');

-- Read: reporters can also see their own non-approved incidents
create policy "incidents: reporters can read own incidents"
    on public.incidents
    for select
    to authenticated
    using (reporter_id = auth.uid());

-- Insert: any authenticated user can file a new incident
create policy "incidents: authenticated users can insert"
    on public.incidents
    for insert
    to authenticated
    with check (
        reporter_id = auth.uid()  -- must claim authorship
        and status = 'pending'    -- must start in pending state
    );

-- Update: reporters can edit their own pending incidents only
create policy "incidents: reporters can update own pending"
    on public.incidents
    for update
    to authenticated
    using (
        reporter_id = auth.uid()
        and status = 'pending'
    )
    with check (
        reporter_id = auth.uid()
        and status = 'pending'   -- cannot self-approve or self-remove
    );


-- =============================================================================
-- notifications
-- - Users can only see their own notifications.
-- - Users can mark their own notifications as read (update read_at).
-- - Inserts are performed by server-side functions / service role only.
-- =============================================================================

-- Read: users can only fetch their own notifications
create policy "notifications: users can read own"
    on public.notifications
    for select
    to authenticated
    using (user_id = auth.uid());

-- Update: users can mark their own notifications as read
create policy "notifications: users can mark own as read"
    on public.notifications
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());


-- =============================================================================
-- user_preferences
-- - Users can only read and edit their own preferences row.
-- - Insert is allowed so the row can be created on first use.
-- =============================================================================

-- Read: own preferences only
create policy "user_preferences: users can read own"
    on public.user_preferences
    for select
    to authenticated
    using (user_id = auth.uid());

-- Insert: users can create their own preferences row
create policy "user_preferences: users can insert own"
    on public.user_preferences
    for insert
    to authenticated
    with check (user_id = auth.uid());

-- Update: users can modify their own preferences
create policy "user_preferences: users can update own"
    on public.user_preferences
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

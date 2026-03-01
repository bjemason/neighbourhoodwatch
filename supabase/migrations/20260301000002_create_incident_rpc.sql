-- RPC function for creating incidents with PostGIS geometry
-- Called from the client to avoid raw geometry string handling

CREATE OR REPLACE FUNCTION create_incident(
  p_category_id int,
  p_title text,
  p_description text,
  p_lat double precision,
  p_lng double precision,
  p_location_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure a profile row exists (safety net if trigger hasn't run)
  INSERT INTO profiles (id)
  VALUES (auth.uid())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO incidents (
    reporter_id,
    category_id,
    title,
    description,
    location,
    location_name,
    status
  ) VALUES (
    auth.uid(),
    p_category_id,
    p_title,
    p_description,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
    p_location_name,
    'pending'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_incident TO authenticated;

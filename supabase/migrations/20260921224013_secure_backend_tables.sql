-- YVY uses Passport sessions and server-side PostgreSQL, not Supabase Auth.
-- Browser roles must not access these tables via PostgREST/GraphQL.
-- Keep the backend/table-owner privileges and existing sessions unchanged.
SET lock_timeout = '5s';
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['session','farms','alerts','readings','reports','users','tasks','zones','clients'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', table_name);
  END LOOP;
END $$;

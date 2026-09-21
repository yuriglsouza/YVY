-- Run against the migrated database as postgres. No application data is read or changed.
DO $$
DECLARE table_name text; role_name text; privilege_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['session','farms','alerts','readings','reports','users','tasks','zones','clients','farm_visits'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || table_name)::regclass) THEN
      RAISE EXCEPTION 'RLS missing: %', table_name;
    END IF;
    FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'] LOOP
      FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF has_table_privilege(role_name, 'public.' || table_name, privilege_name) THEN
          RAISE EXCEPTION 'Unexpected % access for % on %', privilege_name, role_name, table_name;
        END IF;
      END LOOP;
      IF NOT has_table_privilege('postgres', 'public.' || table_name, privilege_name) THEN
        RAISE EXCEPTION 'Backend privilege missing on %', table_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;

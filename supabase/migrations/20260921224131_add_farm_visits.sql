SET lock_timeout = '5s';
CREATE TABLE public.farm_visits (
  id serial PRIMARY KEY,
  farm_id integer NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  author_id integer REFERENCES public.users(id) ON DELETE SET NULL,
  observed_on date NOT NULL,
  stage text NOT NULL DEFAULT '',
  observations text NOT NULL,
  management text NOT NULL DEFAULT '',
  photo_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT farm_visits_photo_array CHECK (jsonb_typeof(photo_paths) = 'array' AND jsonb_array_length(photo_paths) <= 4)
);
CREATE INDEX farm_visits_farm_date_idx ON public.farm_visits(farm_id, observed_on DESC, id DESC);
ALTER TABLE public.farm_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.farm_visits FROM anon, authenticated, PUBLIC;
REVOKE ALL ON SEQUENCE public.farm_visits_id_seq FROM anon, authenticated, PUBLIC;

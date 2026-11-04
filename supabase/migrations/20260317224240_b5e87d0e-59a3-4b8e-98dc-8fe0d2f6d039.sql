
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read app_settings"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow anon update app_settings"
ON public.app_settings
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

INSERT INTO public.app_settings (key, value) VALUES ('access_password', '1234');

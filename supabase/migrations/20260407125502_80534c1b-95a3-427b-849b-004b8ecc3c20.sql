CREATE TABLE public.client_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL,
  code text NOT NULL,
  description text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all client_services"
ON public.client_services
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
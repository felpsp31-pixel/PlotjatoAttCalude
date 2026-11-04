CREATE TABLE public.clientes_avulsos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes_avulsos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all clientes_avulsos"
  ON public.clientes_avulsos
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Add optional column to recibos for avulso client name
ALTER TABLE public.recibos
  ADD COLUMN cliente_avulso TEXT DEFAULT NULL;
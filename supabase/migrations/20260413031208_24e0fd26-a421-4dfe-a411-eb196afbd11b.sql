
-- Create responsaveis table
CREATE TABLE public.responsaveis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all responsaveis"
  ON public.responsaveis FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Create demandas table
CREATE TABLE public.demandas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT NOT NULL,
  telefone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  servico TEXT NOT NULL DEFAULT '',
  prazo DATE,
  responsavel_id UUID REFERENCES public.responsaveis(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.demandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all demandas"
  ON public.demandas FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

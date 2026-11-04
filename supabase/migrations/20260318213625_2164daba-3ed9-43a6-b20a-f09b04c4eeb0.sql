
-- empresa_info
CREATE TABLE public.empresa_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Minha Empresa',
  cnpj text NOT NULL DEFAULT '00.000.000/0001-00',
  address text NOT NULL DEFAULT 'Endereço da empresa',
  phone text NOT NULL DEFAULT '(00) 0000-0000',
  email text NOT NULL DEFAULT 'contato@empresa.com',
  logo text NOT NULL DEFAULT ''
);
ALTER TABLE public.empresa_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all empresa_info" ON public.empresa_info FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- clientes
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all clientes" ON public.clientes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- solicitantes
CREATE TABLE public.solicitantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL DEFAULT ''
);
ALTER TABLE public.solicitantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all solicitantes" ON public.solicitantes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- obras
CREATE TABLE public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  name text NOT NULL
);
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all obras" ON public.obras FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- servicos
CREATE TABLE public.servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  unit_price numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all servicos" ON public.servicos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- recibos
CREATE TABLE public.recibos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  solicitante_id uuid REFERENCES public.solicitantes(id) ON DELETE SET NULL,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all recibos" ON public.recibos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  retains_iss boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all suppliers" ON public.suppliers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

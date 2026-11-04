
-- Table for financial invoices (replacing in-memory mock data)
CREATE TABLE public.financial_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'client',
  description TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  reference_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store monthly recibo summaries per client (synced from client app)
CREATE TABLE public.monthly_recibo_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  cliente_name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  month TEXT NOT NULL, -- format YYYY-MM
  total NUMERIC NOT NULL DEFAULT 0,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cnpj, month)
);

-- RLS policies for financial_invoices
ALTER TABLE public.financial_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select financial_invoices" ON public.financial_invoices
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow anon insert financial_invoices" ON public.financial_invoices
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow anon update financial_invoices" ON public.financial_invoices
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete financial_invoices" ON public.financial_invoices
  FOR DELETE TO anon, authenticated USING (true);

-- RLS policies for monthly_recibo_summaries
ALTER TABLE public.monthly_recibo_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select monthly_recibo_summaries" ON public.monthly_recibo_summaries
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow anon insert monthly_recibo_summaries" ON public.monthly_recibo_summaries
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow anon update monthly_recibo_summaries" ON public.monthly_recibo_summaries
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete monthly_recibo_summaries" ON public.monthly_recibo_summaries
  FOR DELETE TO anon, authenticated USING (true);

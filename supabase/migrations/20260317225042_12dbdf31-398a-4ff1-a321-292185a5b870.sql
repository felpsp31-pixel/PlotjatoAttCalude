
CREATE TABLE public.notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_nfse text,
  tomador text,
  valor_liquido numeric,
  issqn_retido numeric,
  vencimento date,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read notas_fiscais"
ON public.notas_fiscais
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow anon insert notas_fiscais"
ON public.notas_fiscais
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-fiscais', 'notas-fiscais', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read notas-fiscais"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'notas-fiscais');

CREATE POLICY "Allow public upload notas-fiscais"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'notas-fiscais');

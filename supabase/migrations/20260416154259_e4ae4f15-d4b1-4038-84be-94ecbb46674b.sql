ALTER TABLE public.demandas
  ADD COLUMN tipo_saida text DEFAULT NULL,
  ADD COLUMN retirado boolean NOT NULL DEFAULT false,
  ADD COLUMN retirado_at timestamp with time zone DEFAULT NULL;
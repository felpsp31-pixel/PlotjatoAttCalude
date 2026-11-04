
ALTER TABLE public.demandas 
  ALTER COLUMN prazo TYPE TIMESTAMP WITH TIME ZONE USING prazo::timestamp with time zone;

ALTER TABLE public.demandas 
  ADD COLUMN prioridade TEXT NOT NULL DEFAULT 'media';

ALTER TABLE public.demandas 
  ADD COLUMN canal TEXT NOT NULL DEFAULT '';

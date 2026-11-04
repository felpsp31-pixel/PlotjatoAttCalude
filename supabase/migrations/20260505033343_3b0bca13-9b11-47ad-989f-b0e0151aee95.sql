
-- Unique index to guarantee no duplicate numbers
CREATE UNIQUE INDEX IF NOT EXISTS recibos_number_unique ON public.recibos (number);

-- Sequence for receipt numbers
DO $$
DECLARE
  start_val bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(number, '\D', '', 'g'), '')::bigint), 0) + 1
    INTO start_val FROM public.recibos;
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.recibo_number_seq START WITH %s', start_val);
END $$;

-- Function returns next 4-digit zero-padded number, retrying if collision exists
CREATE OR REPLACE FUNCTION public.next_recibo_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
  formatted text;
BEGIN
  LOOP
    n := nextval('public.recibo_number_seq');
    formatted := lpad(n::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.recibos WHERE number = formatted);
  END LOOP;
  RETURN formatted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_recibo_number() TO authenticated, anon;

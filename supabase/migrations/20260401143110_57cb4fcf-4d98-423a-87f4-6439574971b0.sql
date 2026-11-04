ALTER TABLE public.obras
ADD COLUMN has_delivery boolean NOT NULL DEFAULT false,
ADD COLUMN delivery_value numeric NOT NULL DEFAULT 0;
-- Desconto por quantidade: servicos marcados com desconto_qtd tem faixas
-- [{ "qtd": 10, "valor": 0.8 }, ...]; a maior faixa atingida vale para todas as unidades.
alter table public.servicos add column if not exists desconto_qtd boolean not null default false;
alter table public.servicos add column if not exists faixas_desconto jsonb not null default '[]'::jsonb;

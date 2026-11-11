-- Obra digitada na hora, para trabalhos que nao valem um cadastro.
-- Guarda so o nome, como ja acontece com o cliente avulso.
alter table public.recibos add column if not exists obra_avulsa text;

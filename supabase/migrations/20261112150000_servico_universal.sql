-- Volta ao modelo anterior: quem tem preco proprio ve a tabela dele.
-- A excecao agora e marcada no proprio servico: "universal" aparece para
-- todos os clientes, inclusive os que tem tabela propria.
alter table public.servicos add column if not exists universal boolean not null default false;

-- Desfaz o vinculo de preco especial e devolve os codigos originais.
update public.client_services set code = 'tmp-' || id where servico_id is not null;
update public.client_services cs set code = v.code, servico_id = null
from (values
  ('Plotagem A0 Corbis', '2'),
  ('Plotagem A1 Corbis', '8'),
  ('Plotagem A2 Corbis', '9'),
  ('Impressão A3 Corbis', '10'),
  ('Plotagem A0 HPC', '12'),
  ('Plotagem A1 HPC', '13'),
  ('Plotagem A2', '14')
) as v(description, code)
where cs.description = v.description;

drop index if exists client_services_preco_especial_unico;
alter table public.client_services drop column if exists servico_id;

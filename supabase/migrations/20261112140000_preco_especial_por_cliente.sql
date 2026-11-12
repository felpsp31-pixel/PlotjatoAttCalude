-- Preco especial: o serviço do cliente pode apontar para um serviço da
-- tabela geral. Com servico_id preenchido, o preço do cliente substitui o
-- universal e o cliente continua enxergando todo o resto da tabela geral.
-- Com servico_id nulo, é um serviço que só aquele cliente tem.
alter table public.client_services
  add column if not exists servico_id uuid references public.servicos(id) on delete cascade;

-- Um preço especial por serviço, por cliente.
create unique index if not exists client_services_preco_especial_unico
  on public.client_services (cliente_id, servico_id)
  where servico_id is not null;

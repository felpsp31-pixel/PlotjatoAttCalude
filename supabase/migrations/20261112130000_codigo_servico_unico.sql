-- Codigo de servico nao se repete: o da tabela geral e unico, e o de cada
-- cliente e unico dentro do cliente. O banco passa a recusar a duplicata
-- mesmo se vier de duas telas abertas ao mesmo tempo.
create unique index if not exists servicos_code_unico on public.servicos (code);
create unique index if not exists client_services_cliente_code_unico
  on public.client_services (cliente_id, code);

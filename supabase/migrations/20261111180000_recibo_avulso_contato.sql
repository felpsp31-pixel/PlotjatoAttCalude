-- Recibo avulso: pago na hora, sem cadastro de cliente. Guarda o contato
-- digitado no proprio recibo, para a reimpressao sair igual ao original.
alter table public.recibos
  add column if not exists cliente_avulso_telefone text,
  add column if not exists cliente_avulso_documento text;

-- O cadastro leve de avulsos tambem guarda o documento.
alter table public.clientes_avulsos add column if not exists documento text;

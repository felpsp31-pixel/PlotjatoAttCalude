-- Sinal: valor ja pago de um recibo avulso que ainda nao foi quitado.
-- O que falta e total - valor_sinal. Avulso (cliente_id nulo) nunca entra no fechamento mensal.
alter table public.recibos add column if not exists valor_sinal numeric(12,2);

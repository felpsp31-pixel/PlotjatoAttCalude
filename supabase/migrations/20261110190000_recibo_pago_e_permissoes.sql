-- Recibo guarda se foi pago no ato e como. O fechamento mensal usa isso:
-- recibos pagos viram lancamento ja recebido; os demais, lancamento em aberto.
alter table public.recibos
  add column if not exists is_pago boolean not null default false,
  add column if not exists forma_pagamento text;

-- Gerar numero de recibo so para quem esta logado (antes, qualquer visitante
-- com a chave publica conseguia consumir numeros).
revoke execute on function public.next_recibo_number() from public, anon;
grant execute on function public.next_recibo_number() to authenticated;

-- Funcao de gatilho: ninguem precisa chama-la direto.
revoke execute on function public.registrar_demanda_concluida() from public, anon, authenticated;

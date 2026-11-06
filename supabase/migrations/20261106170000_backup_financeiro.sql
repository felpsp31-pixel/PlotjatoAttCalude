-- Backups do Financeiro: cada download registra o periodo coberto, para o
-- proximo backup comecar dali. A limpeza apaga so lancamentos PAGOS que
-- estavam no backup; os em aberto ficam, para nao perder cobranca pendente.

create table if not exists public.backups_financeiro (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  periodo_inicio timestamptz,
  periodo_fim timestamptz not null,
  lancamentos integer not null default 0,
  faturamento numeric not null default 0,
  apagados integer not null default 0,
  limpo_em timestamptz
);
alter table public.backups_financeiro enable row level security;
drop policy if exists "financeiro acessa backups_financeiro" on public.backups_financeiro;
create policy "financeiro acessa backups_financeiro" on public.backups_financeiro
  for all to authenticated using (public.e_financeiro()) with check (public.e_financeiro());

-- Apaga os lancamentos pagos do periodo de um backup ja baixado e devolve os
-- anexos deles (para o app apagar os arquivos do Storage).
create or replace function public.limpar_lancamentos_do_backup(p_backup uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.backups_financeiro;
  anexos jsonb;
  qtd integer;
begin
  if not public.e_financeiro() then
    raise exception 'Apenas o Financeiro pode limpar lançamentos.';
  end if;

  select * into b from public.backups_financeiro where id = p_backup;
  if not found then raise exception 'Backup não encontrado.'; end if;
  if b.limpo_em is not null then raise exception 'Este backup já foi usado para limpar.'; end if;

  with apagados as (
    delete from public.financial_invoices
     where status = 'paid'
       and created_at <= b.periodo_fim
       and (b.periodo_inicio is null or created_at > b.periodo_inicio)
    returning attachments
  )
  select count(*), coalesce(jsonb_agg(attachments) filter (where jsonb_array_length(attachments) > 0), '[]'::jsonb)
    into qtd, anexos
    from apagados;

  -- Resumos mensais antigos ja processados nao servem mais.
  delete from public.monthly_recibo_summaries where processed = true;

  update public.backups_financeiro set apagados = qtd, limpo_em = now() where id = p_backup;
  return jsonb_build_object('apagados', qtd, 'anexos', anexos);
end;
$$;

revoke all on function public.limpar_lancamentos_do_backup(uuid) from public, anon;
grant execute on function public.limpar_lancamentos_do_backup(uuid) to authenticated;

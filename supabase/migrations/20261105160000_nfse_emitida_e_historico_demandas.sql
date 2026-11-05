-- 1) NFS-e emitida no lancamento mensal.
--    Numero e data da nota; o PDF vai em attachments, como os demais anexos.
alter table public.financial_invoices
  add column if not exists nfse_numero text,
  add column if not exists nfse_emitida_at timestamptz;

-- 2) Historico de demandas concluidas.
--    A limpeza apaga demandas concluidas depois de 48 horas, entao sem este
--    registro nao haveria como contar atrasos dos ultimos 30 dias. O gatilho
--    grava uma linha quando a demanda e concluida e a remove se ela for
--    reaberta. Guarda o nome do responsavel na hora, para o grafico continuar
--    certo mesmo se o responsavel for apagado depois.
create table if not exists public.demandas_concluidas (
  demanda_id uuid primary key,
  responsavel_id uuid,
  responsavel_nome text,
  cliente_nome text,
  servico text,
  prazo timestamptz,
  concluido_at timestamptz not null,
  atrasada boolean generated always as (prazo is not null and concluido_at > prazo) stored
);

create index if not exists demandas_concluidas_concluido_at_idx
  on public.demandas_concluidas (concluido_at);

alter table public.demandas_concluidas enable row level security;

drop policy if exists "Allow authenticated read demandas_concluidas" on public.demandas_concluidas;
create policy "Allow authenticated read demandas_concluidas" on public.demandas_concluidas
  for select to authenticated using (true);

create or replace function public.registrar_demanda_concluida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'concluido' and new.concluido_at is not null then
    insert into public.demandas_concluidas
      (demanda_id, responsavel_id, responsavel_nome, cliente_nome, servico, prazo, concluido_at)
    values (
      new.id,
      new.responsavel_id,
      (select name from public.responsaveis where id = new.responsavel_id),
      new.cliente_nome,
      new.servico,
      new.prazo::timestamptz,
      new.concluido_at::timestamptz
    )
    on conflict (demanda_id) do update set
      responsavel_id   = excluded.responsavel_id,
      responsavel_nome = excluded.responsavel_nome,
      cliente_nome     = excluded.cliente_nome,
      servico          = excluded.servico,
      prazo            = excluded.prazo,
      concluido_at     = excluded.concluido_at;
  elsif tg_op = 'UPDATE' and old.status = 'concluido' and new.status <> 'concluido' then
    delete from public.demandas_concluidas where demanda_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists demandas_registrar_concluida on public.demandas;
create trigger demandas_registrar_concluida
  after insert or update of status, concluido_at, prazo, responsavel_id on public.demandas
  for each row execute function public.registrar_demanda_concluida();

-- Aproveita as concluidas que ainda nao foram apagadas.
insert into public.demandas_concluidas
  (demanda_id, responsavel_id, responsavel_nome, cliente_nome, servico, prazo, concluido_at)
select d.id, d.responsavel_id, r.name, d.cliente_nome, d.servico, d.prazo::timestamptz, d.concluido_at::timestamptz
  from public.demandas d
  left join public.responsaveis r on r.id = d.responsavel_id
 where d.status = 'concluido' and d.concluido_at is not null
on conflict (demanda_id) do nothing;

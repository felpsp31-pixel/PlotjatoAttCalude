-- Restringe o gatilho do recibo que chega depois do fechamento.
--
-- O usuario do balcao nao tem acesso aos lancamentos do Financeiro. Sem esta
-- restricao, bastava salvar um recibo com data antiga para o gatilho alterar
-- um mes ja fechado. Agora so entra o caso real do modo offline: recibo do
-- mes imediatamente anterior, com no maximo 40 dias, e nao no futuro.
-- Fora disso o recibo e salvo normalmente, mas nao mexe no Financeiro.
create or replace function public.recibo_apos_fechamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meses text[] := array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  mes_anterior date := (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 month')::date;
  ano int := extract(year from new.date);
  mes int := extract(month from new.date);
  ref text;
  situacao text;
  descricao text;
  alvo uuid;
  nome text;
begin
  if new.cliente_id is null then
    return new;
  end if;
  if date_trunc('month', new.date)::date <> mes_anterior
     or new.date < hoje - 40
     or new.date > hoje then
    return new;
  end if;
  ref := meses[mes] || '/' || ano;

  -- O fechamento desse mes ainda nao rodou: ele mesmo vai somar este recibo.
  if not exists (
    select 1 from public.financial_invoices
    where entity_type = 'client' and reference_month = ref and description like 'Recibos - %'
  ) then
    return new;
  end if;

  situacao := case when new.is_pago then 'paid' else 'open' end;
  descricao := case when new.is_pago then 'Recibos - ' || ref || ' (pagos no ato)' else 'Recibos - ' || ref end;

  select id into alvo
  from public.financial_invoices
  where entity_type = 'client' and entity_id = new.cliente_id::text and reference_month = ref
    and status = situacao and description in (descricao, descricao || ' (complementar)')
  order by created_at
  limit 1
  for update;

  if alvo is not null then
    update public.financial_invoices set value = round(value + new.total, 2) where id = alvo;
    return new;
  end if;

  select name into nome from public.clientes where id = new.cliente_id;
  insert into public.financial_invoices
    (entity_id, entity_name, entity_type, description, value, due_date, reference_month, status, attachments)
  values (
    new.cliente_id::text, coalesce(nome, 'Cliente'), 'client',
    case when exists (
      select 1 from public.financial_invoices
      where entity_type = 'client' and entity_id = new.cliente_id::text and reference_month = ref and description = descricao
    ) then descricao || ' (complementar)' else descricao end,
    round(new.total, 2),
    (make_date(ano, mes, 1) + interval '1 month')::date + 9,
    ref, situacao, '[]'::jsonb
  );
  return new;
end;
$$;

revoke execute on function public.recibo_apos_fechamento() from public, anon, authenticated;

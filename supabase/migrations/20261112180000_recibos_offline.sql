-- Emissao de recibo sem internet.
--
-- 1) Cada aparelho reserva um bloco de numeros enquanto esta online. O
--    contador do servidor avanca na reserva, entao nenhum outro aparelho
--    recebe esses numeros.
create or replace function public.reservar_numeros_recibo(qtd integer default 50)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
  f text;
  saida text[] := '{}';
begin
  qtd := least(greatest(coalesce(qtd, 50), 1), 100);
  while coalesce(array_length(saida, 1), 0) < qtd loop
    n := nextval('public.recibo_number_seq');
    f := lpad(n::text, 4, '0');
    if not exists (select 1 from public.recibos where number = f) then
      saida := saida || f;
    end if;
  end loop;
  return saida;
end;
$$;

revoke execute on function public.reservar_numeros_recibo(integer) from public, anon;
grant execute on function public.reservar_numeros_recibo(integer) to authenticated;

-- 2) Recibo faturado que chega depois do fechamento do mes (emitido offline
--    no fim do mes e enviado so depois do dia 1): soma no lancamento daquele
--    cliente e mes, ou cria o lancamento se ainda nao houver. Avulso (sem
--    cliente cadastrado) nunca entra no fechamento.
create or replace function public.recibo_apos_fechamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meses text[] := array['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
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

  -- Soma num lancamento do mesmo tipo que ainda esteja na mesma situacao
  -- (um lancamento em aberto que ja foi pago nao recebe valor novo).
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

drop trigger if exists recibo_apos_fechamento on public.recibos;
create trigger recibo_apos_fechamento
  after insert on public.recibos
  for each row execute function public.recibo_apos_fechamento();

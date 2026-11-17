-- Numeracao dos recibos sem buracos.
--
-- O problema: todo navegador que abria o sistema reservava 50 numeros do
-- mesmo contador dos recibos, e esses numeros so eram usados sem internet.
-- Cada reserva virava um salto de 50 na sequencia.
--
-- Agora:
-- - so o aparelho com o modo offline ativado reserva numeros, e ele usa o
--   bloco tambem com internet (isso fica no site);
-- - cada numero reservado fica registrado com o aparelho que o reservou;
-- - numeros devolvidos (aparelho desativado, reserva esquecida ha 30 dias,
--   recibo que falhou ao salvar) vao para a lista de livres;
-- - o proximo numero sai sempre da lista de livres primeiro (o menor), e so
--   depois do contador;
-- - os numeros que ficaram vagos ate hoje entram na lista de livres.
--
-- Nenhum recibo ja emitido e alterado, e o Financeiro nao e tocado.
-- Numero de recibo excluido NAO volta a ser usado.
-- Rodar uma vez so.

-- ---------- Tabelas ----------

create table if not exists public.recibo_numeros_livres (
  numero text primary key check (numero ~ '^\d+$'),
  liberado_em timestamptz not null default now()
);

create table if not exists public.recibo_numeros_reservados (
  numero text primary key check (numero ~ '^\d+$'),
  aparelho uuid not null,
  reservado_em timestamptz not null default now()
);
create index if not exists recibo_numeros_reservados_aparelho on public.recibo_numeros_reservados (aparelho);

-- So as funcoes abaixo mexem nessas tabelas.
alter table public.recibo_numeros_livres enable row level security;
alter table public.recibo_numeros_reservados enable row level security;
revoke all on public.recibo_numeros_livres from public, anon, authenticated;
revoke all on public.recibo_numeros_reservados from public, anon, authenticated;

-- ---------- Funcoes internas ----------

-- 1 -> 0001; acima de 9999 o numero sai inteiro (lpad cortaria para 4 digitos).
create or replace function public._formatar_numero_recibo(n bigint)
returns text
language sql
immutable
as $$
  select case when n < 10000 then lpad(n::text, 4, '0') else n::text end
$$;

create or replace function public._numero_recibo_ocupado(f text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.recibos where number = f)
      or exists (select 1 from public.recibo_numeros_reservados where numero = f)
$$;

-- Reserva de aparelho que nao aparece ha 30 dias volta para os livres.
create or replace function public._expirar_reservas_recibo()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with velhas as (
    delete from public.recibo_numeros_reservados
    where reservado_em < now() - interval '30 days'
    returning numero
  )
  insert into public.recibo_numeros_livres (numero)
  select v.numero from velhas v
  where not exists (select 1 from public.recibos r where r.number = v.numero)
  on conflict do nothing;
end;
$$;

-- Tira o proximo numero: o menor dos livres; se nao houver, o contador.
-- Quem chama precisa estar com a trava da numeracao.
create or replace function public._tirar_numero_recibo()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  f text;
  n bigint;
begin
  loop
    delete from public.recibo_numeros_livres
    where numero = (select numero from public.recibo_numeros_livres order by numero::bigint limit 1)
    returning numero into f;
    exit when f is null;
    if not public._numero_recibo_ocupado(f) then
      return f;
    end if;
  end loop;

  loop
    n := nextval('public.recibo_number_seq');
    f := public._formatar_numero_recibo(n);
    if not public._numero_recibo_ocupado(f) then
      return f;
    end if;
  end loop;
end;
$$;

create or replace function public._travar_numeracao_recibo()
returns void
language sql
as $$
  select pg_advisory_xact_lock(hashtext('plotjato_numeracao_recibo'))
$$;

revoke execute on function public._formatar_numero_recibo(bigint) from public, anon, authenticated;
revoke execute on function public._numero_recibo_ocupado(text) from public, anon, authenticated;
revoke execute on function public._expirar_reservas_recibo() from public, anon, authenticated;
revoke execute on function public._tirar_numero_recibo() from public, anon, authenticated;
revoke execute on function public._travar_numeracao_recibo() from public, anon, authenticated;

-- ---------- Funcoes usadas pelo site ----------

-- Numero para recibo emitido com internet (aparelho sem bloco).
create or replace function public.next_recibo_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._travar_numeracao_recibo();
  perform public._expirar_reservas_recibo();
  return public._tirar_numero_recibo();
end;
$$;

-- Bloco do aparelho com modo offline ativado. A versao antiga (so com qtd)
-- sai, para navegadores com o site antigo nao reservarem mais numeros.
drop function if exists public.reservar_numeros_recibo(integer);

create or replace function public.reservar_numeros_recibo(qtd integer, aparelho uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  f text;
  saida text[] := '{}';
begin
  if aparelho is null then
    raise exception 'aparelho obrigatorio';
  end if;
  qtd := least(greatest(coalesce(qtd, 50), 1), 100);
  perform public._travar_numeracao_recibo();
  perform public._expirar_reservas_recibo();
  for i in 1..qtd loop
    f := public._tirar_numero_recibo();
    insert into public.recibo_numeros_reservados (numero, aparelho) values (f, aparelho);
    saida := saida || f;
  end loop;
  return saida;
end;
$$;

-- Numeros que o servidor ainda guarda para o aparelho. O site confere o
-- bloco local com esta lista. Tambem renova a reserva (o aparelho esta ativo).
create or replace function public.numeros_do_aparelho(aparelho uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  saida text[];
begin
  delete from public.recibo_numeros_reservados r
  where r.aparelho = numeros_do_aparelho.aparelho
    and exists (select 1 from public.recibos x where x.number = r.numero);
  update public.recibo_numeros_reservados r set reservado_em = now()
  where r.aparelho = numeros_do_aparelho.aparelho;
  select coalesce(array_agg(r.numero order by r.numero::bigint), '{}') into saida
  from public.recibo_numeros_reservados r
  where r.aparelho = numeros_do_aparelho.aparelho;
  return saida;
end;
$$;

-- Aparelho desativado: os numeros que ele nao usou voltam para os livres.
create or replace function public.liberar_numeros_recibo(aparelho uuid, numeros text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  qtd integer;
begin
  perform public._travar_numeracao_recibo();
  with soltos as (
    delete from public.recibo_numeros_reservados r
    where r.aparelho = liberar_numeros_recibo.aparelho and r.numero = any (numeros)
    returning r.numero
  ), livres as (
    insert into public.recibo_numeros_livres (numero)
    select s.numero from soltos s
    where not exists (select 1 from public.recibos x where x.number = s.numero)
    on conflict do nothing
    returning 1
  )
  select count(*) into qtd from livres;
  return qtd;
end;
$$;

-- Recibo que nao chegou a ser salvo (erro do servidor): o numero volta.
-- So aceita numero que o contador ja entregou e que nao esta em uso.
create or replace function public.devolver_numero_recibo(numero text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ultimo bigint;
  chamado boolean;
begin
  if numero is null or numero !~ '^\d+$' then
    return false;
  end if;
  perform public._travar_numeracao_recibo();
  select last_value, is_called into ultimo, chamado from public.recibo_number_seq;
  if not chamado then ultimo := ultimo - 1; end if;
  if numero::bigint < 1 or numero::bigint > ultimo
     or numero <> public._formatar_numero_recibo(numero::bigint)
     or public._numero_recibo_ocupado(numero) then
    return false;
  end if;
  insert into public.recibo_numeros_livres (numero) values (numero) on conflict do nothing;
  return true;
end;
$$;

revoke execute on function public.next_recibo_number() from public, anon;
revoke execute on function public.reservar_numeros_recibo(integer, uuid) from public, anon;
revoke execute on function public.numeros_do_aparelho(uuid) from public, anon;
revoke execute on function public.liberar_numeros_recibo(uuid, text[]) from public, anon;
revoke execute on function public.devolver_numero_recibo(text) from public, anon;
grant execute on function public.next_recibo_number() to authenticated;
grant execute on function public.reservar_numeros_recibo(integer, uuid) to authenticated;
grant execute on function public.numeros_do_aparelho(uuid) to authenticated;
grant execute on function public.liberar_numeros_recibo(uuid, text[]) to authenticated;
grant execute on function public.devolver_numero_recibo(text) to authenticated;

-- ---------- Recibo salvo: o numero deixa de estar reservado ou livre ----------

create or replace function public.recibo_numero_usado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.recibo_numeros_reservados where numero = new.number;
  delete from public.recibo_numeros_livres where numero = new.number;
  return new;
end;
$$;

revoke execute on function public.recibo_numero_usado() from public, anon, authenticated;

drop trigger if exists recibo_numero_usado on public.recibos;
create trigger recibo_numero_usado
  after insert on public.recibos
  for each row execute function public.recibo_numero_usado();

-- ---------- Buracos que ja existem ----------
-- Todo numero entre o primeiro recibo e o ultimo numero entregue pelo
-- contador que nao virou recibo entra nos livres. Os blocos antigos dos
-- navegadores deixam de valer (o site novo os descarta).

do $$
declare
  ultimo bigint;
  chamado boolean;
  primeiro bigint;
begin
  perform public._travar_numeracao_recibo();
  select last_value, is_called into ultimo, chamado from public.recibo_number_seq;
  if not chamado then ultimo := ultimo - 1; end if;
  select min(number::bigint) into primeiro from public.recibos where number ~ '^\d+$';
  if primeiro is null then
    return;
  end if;
  insert into public.recibo_numeros_livres (numero)
  select public._formatar_numero_recibo(n)
  from generate_series(primeiro, ultimo) n
  where not exists (select 1 from public.recibos r where r.number ~ '^\d+$' and r.number::bigint = n)
    and not exists (select 1 from public.recibo_numeros_reservados x where x.numero = public._formatar_numero_recibo(n))
  on conflict do nothing;
end;
$$;

-- Resultado: os numeros vagos que os proximos recibos vao usar primeiro.
select count(*) as numeros_vagos,
       coalesce(string_agg(numero, ', ' order by numero::bigint), 'nenhum') as quais
from public.recibo_numeros_livres;

-- Numero que o proximo recibo vai receber, so para mostrar na tela de
-- emissao. Nao reserva nem consome nada: o numero definitivo continua
-- saindo de next_recibo_number na hora de salvar.
create or replace function public.proximo_numero_recibo()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  f text;
  n bigint;
  ultimo bigint;
  chamado boolean;
begin
  select l.numero into f
  from public.recibo_numeros_livres l
  where not public._numero_recibo_ocupado(l.numero)
  order by l.numero::bigint
  limit 1;
  if f is not null then
    return f;
  end if;
  select last_value, is_called into ultimo, chamado from public.recibo_number_seq;
  n := case when chamado then ultimo + 1 else ultimo end;
  loop
    f := public._formatar_numero_recibo(n);
    exit when not public._numero_recibo_ocupado(f);
    n := n + 1;
  end loop;
  return f;
end;
$$;

revoke execute on function public.proximo_numero_recibo() from public, anon;
grant execute on function public.proximo_numero_recibo() to authenticated;

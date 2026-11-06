-- Seguranca: so o usuario do sistema (app_metadata.papel = 'sistema') acessa.
-- Antes, qualquer sessao "authenticated" valia, e o login anonimo estava
-- aberto a qualquer pessoa com a chave publica do site.

create or replace function public.e_sistema()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'papel', '') = 'sistema'
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

-- Remove todas as policies antigas das tabelas publicas.
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Tabelas de uso normal: o sistema le e grava tudo.
do $$
declare t text;
begin
  foreach t in array array[
    'client_services','clientes','clientes_avulsos','demandas','empresa_info',
    'financial_invoices','monthly_recibo_summaries','notas_fiscais','obras',
    'recibos','responsaveis','servicos','solicitantes','suppliers'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "sistema acessa %1$s" on public.%1$I for all to authenticated using (public.e_sistema()) with check (public.e_sistema())',
      t);
  end loop;
end $$;

-- Historico de demandas: so leitura (quem grava e o gatilho).
alter table public.demandas_concluidas enable row level security;
create policy "sistema le demandas_concluidas" on public.demandas_concluidas
  for select to authenticated using (public.e_sistema());

-- Senhas (hashes): nenhum acesso pelo app; so a funcao validate-password,
-- que usa a service_role.
alter table public.app_settings enable row level security;

-- Tentativas erradas de senha, para limitar adivinhacao.
create table if not exists public.tentativas_senha (
  id bigint generated always as identity primary key,
  ip text not null,
  criado_em timestamptz not null default now()
);
create index if not exists tentativas_senha_ip_idx on public.tentativas_senha (ip, criado_em);
alter table public.tentativas_senha enable row level security;

-- Storage: buckets privados, so o sistema le, envia e apaga.
update storage.buckets set public = false where id in ('notas-fiscais', 'invoice-attachments');
drop policy if exists "Allow public read notas-fiscais" on storage.objects;
drop policy if exists "Allow public reads from invoice-attachments" on storage.objects;
drop policy if exists "Allow public upload notas-fiscais" on storage.objects;
drop policy if exists "Allow public uploads to invoice-attachments" on storage.objects;
drop policy if exists "Authenticated delete invoice-attachments" on storage.objects;
drop policy if exists "Authenticated delete notas-fiscais" on storage.objects;
create policy "sistema le arquivos" on storage.objects for select to authenticated
  using (bucket_id in ('notas-fiscais', 'invoice-attachments') and public.e_sistema());
create policy "sistema envia arquivos" on storage.objects for insert to authenticated
  with check (bucket_id in ('notas-fiscais', 'invoice-attachments') and public.e_sistema());
create policy "sistema apaga arquivos" on storage.objects for delete to authenticated
  using (bucket_id in ('notas-fiscais', 'invoice-attachments') and public.e_sistema());

-- Derruba as sessoes anonimas que ja existiam.
delete from auth.users where is_anonymous;

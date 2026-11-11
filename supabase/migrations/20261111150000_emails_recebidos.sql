-- E-mails da caixa de entrada da empresa, trazidos por um script do Gmail e
-- classificados pela IA. Nada entra direto no sistema: cada e-mail fica
-- "a_revisar" ate alguem aprovar ou descartar na tela.
create table if not exists public.emails_recebidos (
  id uuid primary key default gen_random_uuid(),
  gmail_id text not null unique,          -- evita gravar o mesmo e-mail duas vezes
  recebido_em timestamptz not null,
  remetente text not null default '',
  remetente_email text not null default '',
  assunto text not null default '',
  resumo text not null default '',        -- trecho do corpo, para conferir
  anexos jsonb not null default '[]'::jsonb,
  link text,                              -- abre o e-mail no Gmail
  tipo text not null check (tipo in ('cobranca', 'demanda', 'ignorar')),
  motivo text,                            -- por que a IA classificou assim
  dados jsonb not null default '{}'::jsonb,
  status text not null default 'a_revisar' check (status in ('a_revisar', 'aprovado', 'descartado')),
  criado_em timestamptz not null default now(),
  revisado_em timestamptz,
  resultado_id uuid                       -- demanda ou lancamento criado
);

create index if not exists emails_recebidos_fila_idx
  on public.emails_recebidos (status, tipo, recebido_em desc);

alter table public.emails_recebidos enable row level security;

-- Pedidos de servico e propaganda: quem entrou com a senha de acesso.
-- Cobrancas: so o Financeiro, como todo o resto do dinheiro.
-- Ninguem insere pelo app: quem grava e a funcao receber-email (service role).
drop policy if exists "sistema le emails nao financeiros" on public.emails_recebidos;
create policy "sistema le emails nao financeiros" on public.emails_recebidos
  for select to authenticated using (public.e_sistema() and tipo in ('demanda', 'ignorar'));

drop policy if exists "sistema revisa emails nao financeiros" on public.emails_recebidos;
create policy "sistema revisa emails nao financeiros" on public.emails_recebidos
  for update to authenticated
  using (public.e_sistema() and tipo in ('demanda', 'ignorar'))
  with check (public.e_sistema() and tipo in ('demanda', 'ignorar'));

drop policy if exists "financeiro le cobrancas" on public.emails_recebidos;
create policy "financeiro le cobrancas" on public.emails_recebidos
  for select to authenticated using (public.e_financeiro() and tipo = 'cobranca');

drop policy if exists "financeiro revisa cobrancas" on public.emails_recebidos;
create policy "financeiro revisa cobrancas" on public.emails_recebidos
  for update to authenticated
  using (public.e_financeiro() and tipo = 'cobranca')
  with check (public.e_financeiro() and tipo = 'cobranca');

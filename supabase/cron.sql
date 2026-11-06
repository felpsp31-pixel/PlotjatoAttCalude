-- Rotinas agendadas do Plotjato Controle.
--
-- NÃO rode este arquivo como migration e NÃO preencha as chaves aqui.
-- Copie para o SQL Editor do Supabase, troque os dois marcadores pelos
-- valores do seu projeto e execute lá. A service role key dá acesso total
-- ao banco: ela não pode ser commitada neste repositório.
--
--   SEU_PROJECT_REF   em Settings → General → Reference ID
--   SUA_SERVICE_KEY   em Settings → API → service_role (secret)
--
-- Antes: ative pg_cron e pg_net em Database → Extensions, e publique as
-- funções generate-monthly-invoices e cleanup-demandas.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------
-- 1. Lançamento mensal: todo dia 1, junta os recibos do mês anterior
--    num lançamento por cliente no Financeiro.
--
-- Horário: 09:00 UTC = 06:00 em Brasília. O dia 1 começa no Brasil às
-- 03:00 UTC, então rodar às 09:00 garante que o mês anterior já fechou
-- de verdade — às 01:00 UTC ainda seria dia 30 à noite aqui, e os
-- recibos daquela última noite ficariam de fora.
--
-- A função é idempotente: ela pula clientes que já têm lançamento para o
-- mês de referência. Rodar duas vezes não duplica nada.
-- ---------------------------------------------------------------------
select cron.unschedule('lancamento-mensal')
  where exists (select 1 from cron.job where jobname = 'lancamento-mensal');

select cron.schedule(
  'lancamento-mensal',
  '0 9 1 * *',
  $$
  select net.http_post(
    url     := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/generate-monthly-invoices',
    headers := '{"Content-Type":"application/json","x-cron-secret":"SEU_CRON_SECRET"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ---------------------------------------------------------------------
-- 2. Limpeza de demandas concluídas há mais de 48 horas. Diária, 05:00
--    em Brasília, antes de a gráfica abrir.
--
-- Esta função não usa a service role: ela espera o segredo próprio, no
-- header x-cleanup-secret. Use o mesmo valor do secret CLEANUP_SECRET.
-- ---------------------------------------------------------------------
select cron.unschedule('limpeza-demandas')
  where exists (select 1 from cron.job where jobname = 'limpeza-demandas');

select cron.schedule(
  'limpeza-demandas',
  '0 8 * * *',
  $$
  select net.http_post(
    url     := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/cleanup-demandas',
    headers := '{"Content-Type":"application/json","x-cleanup-secret":"SEU_CLEANUP_SECRET"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------

-- Os dois jobs devem aparecer aqui, com active = true:
--   select jobid, jobname, schedule, active from cron.job;

-- Últimas execuções e se deram certo:
--   select jobid, status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 10;

-- O status HTTP que o Supabase devolveu (200 = ok, 401 = chave errada):
--   select id, status_code, content from net._http_response
--    order by id desc limit 10;

-- Para testar agora, sem esperar o dia 1, rode o http_post do job 1
-- direto no SQL Editor. Como é idempotente, o pior caso é não inserir
-- nada. Para fechar um mês específico, troque o body por
-- '{"month":"2026-10"}'::jsonb.

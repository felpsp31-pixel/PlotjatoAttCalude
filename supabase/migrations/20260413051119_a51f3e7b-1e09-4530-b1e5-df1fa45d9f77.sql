
-- financial_invoices
DROP POLICY IF EXISTS "Allow anon select financial_invoices" ON public.financial_invoices;
DROP POLICY IF EXISTS "Allow anon insert financial_invoices" ON public.financial_invoices;
DROP POLICY IF EXISTS "Allow anon update financial_invoices" ON public.financial_invoices;
DROP POLICY IF EXISTS "Allow anon delete financial_invoices" ON public.financial_invoices;

CREATE POLICY "Allow authenticated select financial_invoices" ON public.financial_invoices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert financial_invoices" ON public.financial_invoices
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update financial_invoices" ON public.financial_invoices
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete financial_invoices" ON public.financial_invoices
  FOR DELETE TO authenticated USING (true);

-- monthly_recibo_summaries
DROP POLICY IF EXISTS "Allow anon select monthly_recibo_summaries" ON public.monthly_recibo_summaries;
DROP POLICY IF EXISTS "Allow anon insert monthly_recibo_summaries" ON public.monthly_recibo_summaries;
DROP POLICY IF EXISTS "Allow anon update monthly_recibo_summaries" ON public.monthly_recibo_summaries;
DROP POLICY IF EXISTS "Allow anon delete monthly_recibo_summaries" ON public.monthly_recibo_summaries;

CREATE POLICY "Allow authenticated select monthly_recibo_summaries" ON public.monthly_recibo_summaries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert monthly_recibo_summaries" ON public.monthly_recibo_summaries
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update monthly_recibo_summaries" ON public.monthly_recibo_summaries
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete monthly_recibo_summaries" ON public.monthly_recibo_summaries
  FOR DELETE TO authenticated USING (true);

-- empresa_info
DROP POLICY IF EXISTS "Allow all empresa_info" ON public.empresa_info;
CREATE POLICY "Allow authenticated all empresa_info" ON public.empresa_info
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- clientes
DROP POLICY IF EXISTS "Allow all clientes" ON public.clientes;
CREATE POLICY "Allow authenticated all clientes" ON public.clientes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- solicitantes
DROP POLICY IF EXISTS "Allow all solicitantes" ON public.solicitantes;
CREATE POLICY "Allow authenticated all solicitantes" ON public.solicitantes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- obras
DROP POLICY IF EXISTS "Allow all obras" ON public.obras;
CREATE POLICY "Allow authenticated all obras" ON public.obras
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- servicos
DROP POLICY IF EXISTS "Allow all servicos" ON public.servicos;
CREATE POLICY "Allow authenticated all servicos" ON public.servicos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- recibos
DROP POLICY IF EXISTS "Allow all recibos" ON public.recibos;
CREATE POLICY "Allow authenticated all recibos" ON public.recibos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- suppliers
DROP POLICY IF EXISTS "Allow all suppliers" ON public.suppliers;
CREATE POLICY "Allow authenticated all suppliers" ON public.suppliers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- client_services
DROP POLICY IF EXISTS "Allow all client_services" ON public.client_services;
CREATE POLICY "Allow authenticated all client_services" ON public.client_services
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- responsaveis
DROP POLICY IF EXISTS "Allow all responsaveis" ON public.responsaveis;
CREATE POLICY "Allow authenticated all responsaveis" ON public.responsaveis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- demandas
DROP POLICY IF EXISTS "Allow all demandas" ON public.demandas;
CREATE POLICY "Allow authenticated all demandas" ON public.demandas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- clientes_avulsos
DROP POLICY IF EXISTS "Allow all clientes_avulsos" ON public.clientes_avulsos;
CREATE POLICY "Allow authenticated all clientes_avulsos" ON public.clientes_avulsos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- notas_fiscais
DROP POLICY IF EXISTS "Allow anon read notas_fiscais" ON public.notas_fiscais;
DROP POLICY IF EXISTS "Allow anon insert notas_fiscais" ON public.notas_fiscais;
CREATE POLICY "Allow authenticated read notas_fiscais" ON public.notas_fiscais
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert notas_fiscais" ON public.notas_fiscais
  FOR INSERT TO authenticated WITH CHECK (true);

-- app_settings: manter leitura anon para login, restringir update para authenticated
DROP POLICY IF EXISTS "Allow anon update app_settings" ON public.app_settings;
CREATE POLICY "Allow authenticated update app_settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

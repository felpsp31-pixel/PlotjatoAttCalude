-- Segundo usuario fixo, "financeiro" (entra com a senha do Financeiro).
-- Ele acessa tudo do "sistema" e, so ele, os dados financeiros.

create or replace function public.e_sistema()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'papel', '') in ('sistema', 'financeiro')
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

create or replace function public.e_financeiro()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'papel', '') = 'financeiro'
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

do $$
declare t text;
begin
  foreach t in array array['financial_invoices','monthly_recibo_summaries','notas_fiscais','suppliers'] loop
    execute format('drop policy if exists "sistema acessa %1$s" on public.%1$I', t);
    execute format(
      'create policy "financeiro acessa %1$s" on public.%1$I for all to authenticated using (public.e_financeiro()) with check (public.e_financeiro())',
      t);
  end loop;
end $$;

-- Anexos e PDFs de notas sao do Financeiro.
drop policy if exists "sistema le arquivos" on storage.objects;
drop policy if exists "sistema envia arquivos" on storage.objects;
drop policy if exists "sistema apaga arquivos" on storage.objects;
create policy "financeiro le arquivos" on storage.objects for select to authenticated
  using (bucket_id in ('notas-fiscais', 'invoice-attachments') and public.e_financeiro());
create policy "financeiro envia arquivos" on storage.objects for insert to authenticated
  with check (bucket_id in ('notas-fiscais', 'invoice-attachments') and public.e_financeiro());
create policy "financeiro apaga arquivos" on storage.objects for delete to authenticated
  using (bucket_id in ('notas-fiscais', 'invoice-attachments') and public.e_financeiro());

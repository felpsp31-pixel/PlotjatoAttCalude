# Plotjato Controle

Sistema interno de gestão da Plotjato, com três módulos: **Demandas**, **Emissão de Recibos** e **Financeiro**.

Stack: React 18 + TypeScript + Vite + Tailwind + shadcn/ui no frontend, Supabase (Postgres, Auth, Storage e Edge Functions) no backend.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com os dados do seu projeto Supabase
npm run dev
```

O app sobe em `http://localhost:8080`.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build localmente |
| `npm run lint` | ESLint |
| `npm test` | Testes (Vitest) |

## Configuração do Supabase

### 1. Banco

As migrations estão em `supabase/migrations/`, em ordem cronológica. Em um projeto novo:

```bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

### 2. Autenticação

Ative **Anonymous sign-ins** em *Authentication → Providers*. O `AuthContext` chama `signInAnonymously()` após validar a senha — sem isso o login passa, mas as políticas de RLS bloqueiam todas as consultas.

### 3. Storage

Crie dois buckets com acesso público de leitura:

- `invoice-attachments` — anexos dos lançamentos financeiros
- `notas-fiscais` — PDFs das notas fiscais importadas

### 4. Edge Functions

```bash
npx supabase functions deploy validate-password
npx supabase functions deploy extrair-nota
npx supabase functions deploy extract-pdf-data
npx supabase functions deploy cleanup-demandas
npx supabase functions deploy generate-monthly-invoices
```

### 5. Secrets

Em *Edge Functions → Secrets*:

| Secret | Para que serve |
| --- | --- |
| `GEMINI_API_KEY` | Leitura de PDF por IA (NFS-e e boletos). Chave gratuita em aistudio.google.com |
| `GEMINI_MODEL` | Opcional. Sem ele as funções usam `gemini-3.1-flash-lite` e, se esse nome sair do ar ou ficar sem cota, consultam a API e descem a lista de modelos que a chave realmente tem (flash-lite primeiro, que é o mais folgado na camada gratuita). Preencha só para forçar um modelo |
| `CLEANUP_SECRET` | Protege a função que apaga demandas antigas |
| `ALLOWED_ORIGIN` | Domínio do frontend, para o CORS |
| `VITE_SYSTEM_PASSWORD` | Senha de acesso ao sistema (fallback inicial) |
| `VITE_FINANCIAL_PASSWORD` | Senha do módulo Financeiro (fallback inicial) |
| `VITE_REPORTS_PASSWORD` | Senha do módulo de Recibos (fallback inicial) |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pelo Supabase.

As senhas em `app_settings` são guardadas como hash bcrypt. Na primeira vez que alguém entra com a senha definida no secret, a função `validate-password` grava o hash no banco e passa a validar por ele.

### 6. Rotinas agendadas

Ative as extensões `pg_cron` e `pg_net` em *Database → Extensions* e agende as duas funções com `cron.schedule()`, apontando para as URLs do seu projeto:

- `cleanup-demandas` — apaga demandas concluídas há mais de 48 horas
- `generate-monthly-invoices` — gera as faturas do mês a partir dos recibos emitidos

## Deploy do frontend

Qualquer host estático serve. Na Vercel, conecte o repositório, confirme o preset Vite e cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em *Environment Variables*.

Depois do primeiro deploy, coloque o domínio gerado no secret `ALLOWED_ORIGIN` do Supabase.

## Estrutura

```
src/
  components/        Componentes compartilhados e UI (shadcn)
  contexts/          AuthContext e RecibosContext
  hooks/             useFinancialInvoices, useSuppliers
  lib/               reciboPdf (geração do PDF em A5), utils
  pages/             Dashboard, Home, Login
  pages/recibos/     Emissão, Clientes, Serviços, Relatórios, Demandas
supabase/
  functions/         5 edge functions
  migrations/        Schema e políticas de RLS
```

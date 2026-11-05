import { describe, it, expect } from 'vitest';
import { mensagemDoErro } from './edgeError';

// O supabase-js lanca um FunctionsHttpError: mensagem generica fixa e o
// corpo real pendurado em `context`, que e um Response nao lido.
function erroHttp(status: number, corpo: unknown, tipo = 'json') {
  const body = tipo === 'json' ? JSON.stringify(corpo) : String(corpo);
  const err = new Error('Edge Function returned a non-2xx status code');
  (err as unknown as { context: Response }).context = new Response(body, {
    status,
    headers: { 'Content-Type': tipo === 'json' ? 'application/json' : 'text/plain' },
  });
  return err;
}

describe('mensagemDoErro', () => {
  it('troca a frase generica pelo motivo que a funcao devolveu', async () => {
    const msg = await mensagemDoErro(erroHttp(500, {
      error: 'Nenhum modelo de IA compativel esta disponivel para esta chave.',
      detail: '[404] models/gemini-3.1-flash is not found',
      modelo: 'gemini-3.1-flash',
      modelos_disponiveis: ['gemini-flash-latest', 'gemini-2.5-flash'],
    }));
    expect(msg).toContain('Nenhum modelo de IA compativel');
    expect(msg).toContain('gemini-3.1-flash');
    expect(msg).toContain('gemini-flash-latest');
    expect(msg).not.toContain('non-2xx');
  });

  it('mostra a cota estourada em vez da frase generica', async () => {
    const msg = await mensagemDoErro(erroHttp(429, {
      error: 'Cota da IA esgotada. Veja o detalhe para saber se e por minuto ou por dia.',
      detail: '[429] quota exceeded',
    }));
    expect(msg).toContain('Cota da IA esgotada');
  });

  it('usa o texto cru quando o corpo nao e JSON', async () => {
    const msg = await mensagemDoErro(erroHttp(502, 'Bad Gateway', 'texto'));
    expect(msg).toBe('Bad Gateway');
  });

  it('cai no padrao com o status quando o corpo vem vazio', async () => {
    const msg = await mensagemDoErro(erroHttp(503, '', 'texto'), 'Falhou.');
    expect(msg).toBe('Falhou. (HTTP 503)');
  });

  it('nao quebra o Response para quem ler depois', async () => {
    const err = erroHttp(500, { error: 'x' });
    await mensagemDoErro(err);
    const ctx = (err as unknown as { context: Response }).context;
    // o clone preserva o corpo original: bodyUsed segue falso
    expect(ctx.bodyUsed).toBe(false);
  });

  it('aproveita a mensagem de um Error comum', async () => {
    expect(await mensagemDoErro(new Error('Bucket not found'))).toBe('Bucket not found');
  });

  it('usa o padrao para um erro sem forma conhecida', async () => {
    expect(await mensagemDoErro({ qualquer: 1 }, 'Padrao.')).toBe('Padrao.');
  });
});

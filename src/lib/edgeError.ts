/**
 * Quando uma edge function responde fora da faixa 2xx, o supabase-js devolve
 * um FunctionsHttpError cuja mensagem e sempre a mesma frase generica
 * ("Edge Function returned a non-2xx status code") e deixa o corpo da
 * resposta sem ler, em `context`. O motivo de verdade — modelo de IA fora do
 * ar, cota estourada, chave invalida — fica ali dentro e nunca chega na tela,
 * o que transforma qualquer erro numa adivinhacao.
 *
 * mensagemDoErro le esse corpo e monta uma frase que diz o que aconteceu.
 */

type CorpoDeErro = {
  error?: string;
  detail?: string;
  modelo?: string;
  modelos_disponiveis?: string[];
};

function temContextoHttp(e: unknown): e is { context: Response } {
  return (
    typeof e === "object" && e !== null && "context" in e &&
    typeof (e as { context?: unknown }).context === "object" &&
    (e as { context?: unknown }).context !== null &&
    typeof (e as { context: { json?: unknown } }).context.json === "function"
  );
}

export async function mensagemDoErro(
  err: unknown,
  padrao = "Nao foi possivel concluir a operacao.",
): Promise<string> {
  if (temContextoHttp(err)) {
    try {
      // `context` e um Response; so pode ser lido uma vez, por isso o clone.
      const corpo: CorpoDeErro = await err.context.clone().json();
      const partes = [corpo.error ?? padrao];
      if (corpo.detail) partes.push(corpo.detail);
      if (corpo.modelo) partes.push(`Modelo tentado: ${corpo.modelo}.`);
      if (corpo.modelos_disponiveis?.length) {
        partes.push(`Disponiveis: ${corpo.modelos_disponiveis.join(", ")}.`);
      }
      return partes.join(" ");
    } catch {
      // Corpo vazio ou nao-JSON: cai no texto cru, melhor que a frase generica.
      try {
        const texto = (await err.context.clone().text()).trim();
        if (texto) return texto.slice(0, 400);
      } catch { /* ignora */ }
    }
    const status = (err as { context: Response }).context.status;
    if (status) return `${padrao} (HTTP ${status})`;
  }

  if (err instanceof Error && err.message) return err.message;
  return padrao;
}

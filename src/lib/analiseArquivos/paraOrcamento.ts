// Liga a análise de arquivos ao orçamento: agrupa as folhas em itens e acha,
// na tabela de valores, o serviço com o mesmo formato, "+" e cor.
import type { ArquivoAnalisado } from './resumo';
import { formatarCm } from './regras';

export type CorImpressao = 'Color' | 'PB';

export const NOME_COR: Record<CorImpressao, string> = { Color: 'Colorido', PB: 'Preto e branco' };

/** Um item que vai para o orçamento, já com a quantidade (folhas × cópias). */
export interface ItemImportado {
  /** Identifica o item para refazer a linha se o cliente mudar. */
  chave: string;
  /** Nome procurado na tabela, sem a cor (ex.: "A1 +"). */
  nomeTabela: string;
  quantidade: number;
  /** Preenchido quando o valor tem de ser digitado à mão. */
  motivoManual: string | null;
}

export interface ImportacaoAnalise {
  cor: CorImpressao;
  copias: number;
  itens: ItemImportado[];
}

/**
 * Agrupa as folhas lidas. Folhas pela tabela viram um item por nome; folhas de
 * valor manual ficam uma por item, com a medida ou o preenchimento na descrição,
 * porque cada uma pode ter um preço diferente.
 */
export function montarItens(arquivos: ArquivoAnalisado[], copias: number): ItemImportado[] {
  const n = Math.max(1, Math.floor(copias) || 1);
  const pelaTabela = new Map<string, number>();
  const manuais: ItemImportado[] = [];
  for (const a of arquivos) {
    for (const f of a.folhas) {
      if (!f.manual) {
        pelaTabela.set(f.nomeTabela, (pelaTabela.get(f.nomeTabela) ?? 0) + 1);
        continue;
      }
      const comp = Math.max(f.larguraMm, f.alturaMm);
      const detalhe = f.acimaDaTabela
        ? `${formatarCm(comp)} cm, acima do ++`
        : `${Math.round(f.preenchimento ?? 0)}% de preenchimento`;
      manuais.push({ chave: `m:${a.caminho}:${f.pagina}`, nomeTabela: f.formato, quantidade: n, motivoManual: detalhe });
    }
  }
  const itens: ItemImportado[] = [...pelaTabela.entries()].map(([nome, qtd]) => ({
    chave: `t:${nome}`, nomeTabela: nome, quantidade: qtd * n, motivoManual: null,
  }));
  // Mesmo formato e mesmo detalhe (ex.: duas folhas de 150 cm) viram um item só.
  const manuaisAgrupados = new Map<string, ItemImportado>();
  for (const m of manuais) {
    const k = `${m.nomeTabela}|${m.motivoManual}`;
    const atual = manuaisAgrupados.get(k);
    if (atual) atual.quantidade += m.quantidade;
    else manuaisAgrupados.set(k, { ...m, chave: `m:${k}` });
  }
  return [...itens, ...manuaisAgrupados.values()];
}

// ---------------------------------------------------------------------------
// Casar com a tabela

interface ChaveServico {
  formato: string;
  plus: number;
  cor: CorImpressao | null;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Lê formato, quantidade de "+" e cor da descrição de um serviço (ex.: "Plotagem A1 + Color"). */
export function lerDescricao(descricao: string): ChaveServico | null {
  const d = semAcento(descricao);
  const fmt = d.match(/\ba\s?([0-4])(?![0-9])/);
  if (!fmt) return null;
  const plus = (d.match(/\+/g) ?? []).length;
  let cor: CorImpressao | null = null;
  if (/\b(p\s*[&/.]?\s*b|preto\s*(e|&)?\s*branco|monocrom\w*)\b/.test(d)) cor = 'PB';
  else if (/\b(color|colorid[oa]|colour|cor|cores)\b/.test(d)) cor = 'Color';
  return { formato: `A${fmt[1]}`, plus, cor };
}

export interface ServicoDaTabela {
  /** Valor usado na linha do formulário (código comum ou "CS:código" do cliente). */
  value: string;
  description: string;
  unitPrice: number;
}

/** Acha o serviço com o mesmo formato, "+" e cor. Sem cor na descrição não casa. */
export function acharServico(nomeTabela: string, cor: CorImpressao, servicos: ServicoDaTabela[]): ServicoDaTabela | null {
  const alvo = lerDescricao(nomeTabela);
  if (!alvo) return null;
  return servicos.find(s => {
    const k = lerDescricao(s.description);
    return !!k && k.formato === alvo.formato && k.plus === alvo.plus && k.cor === cor;
  }) ?? null;
}

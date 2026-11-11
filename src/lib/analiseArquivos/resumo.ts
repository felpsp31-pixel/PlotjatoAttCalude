import type { Classificacao } from './regras';
import { FORMATOS_A } from './regras';

export interface FolhaAnalisada extends Classificacao {
  pagina: number;
  larguraMm: number;
  alturaMm: number;
}

export interface ArquivoAnalisado {
  caminho: string;
  folhas: FolhaAnalisada[];
  erro?: string;
}

export interface ItemResumo {
  nomeTabela: string;
  quantidade: number;
}

export interface Resumo {
  arquivos: number;
  folhas: number;
  /** Folhas com valor pela tabela, agrupadas pelo nome da tabela. */
  porNome: ItemResumo[];
  manualTamanho: number;
  manualPreenchimento: number;
  preenchimentoMedio: number | null;
  comErro: number;
}

const ordemFormato = (nome: string) => {
  const i = FORMATOS_A.findIndex(([f]) => nome.startsWith(f));
  return (i < 0 ? 99 : FORMATOS_A.length - i) * 10 + (nome.match(/\+/g)?.length ?? 0);
};

export function resumir(arquivos: ArquivoAnalisado[]): Resumo {
  const cont = new Map<string, number>();
  let folhas = 0, manualTamanho = 0, manualPreenchimento = 0, somaPreench = 0, comPreench = 0;
  for (const a of arquivos) {
    for (const f of a.folhas) {
      folhas++;
      if (f.preenchimento != null) { somaPreench += f.preenchimento; comPreench++; }
      if (f.manual === 'tamanho fora da tabela') manualTamanho++;
      else if (f.manual === 'preenchimento acima de 45%') manualPreenchimento++;
      else cont.set(f.nomeTabela, (cont.get(f.nomeTabela) ?? 0) + 1);
    }
  }
  const porNome = [...cont.entries()]
    .map(([nomeTabela, quantidade]) => ({ nomeTabela, quantidade }))
    .sort((a, b) => ordemFormato(a.nomeTabela) - ordemFormato(b.nomeTabela));
  return {
    arquivos: arquivos.filter(a => !a.erro).length,
    folhas,
    porNome,
    manualTamanho,
    manualPreenchimento,
    preenchimentoMedio: comPreench ? somaPreench / comPreench : null,
    comErro: arquivos.filter(a => a.erro).length,
  };
}

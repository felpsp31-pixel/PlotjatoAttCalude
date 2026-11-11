// Regras da Plotjato para transformar as medidas de uma folha no nome usado
// na tabela de valores (ex.: "A1 +"). Definidas no escopo do leitor de formatos:
// - a largura (lado menor) define o formato A; larguras fora do padrão sobem
//   para o formato seguinte e qualquer folha com mais de 60 cm vira A0;
// - o comprimento define quantos "+": até o comprimento do formato + 2 cm é o
//   padrão, depois vêm as faixas do "+" e do "++" (proporcionais ao formato);
// - passou do "++" ou tem mais de 45% de preenchimento: valor manual.

export type NomeFormato = 'A4' | 'A3' | 'A2' | 'A1' | 'A0';

/** [nome, largura mm, comprimento mm], do menor para o maior. */
export const FORMATOS_A: ReadonlyArray<readonly [NomeFormato, number, number]> = [
  ['A4', 210, 297],
  ['A3', 297, 420],
  ['A2', 420, 594],
  ['A1', 594, 841],
  ['A0', 841, 1189],
];

/** Mesma tolerância do executável (8 pt) para casar a largura com o formato. */
export const TOL_LARGURA_MM = 2.8;
/** O padrão vai até o comprimento original do formato mais 2 cm. */
export const TOL_COMPRIMENTO_MM = 20;
/** Acima desta largura a folha entra na categoria A0. */
export const LARGURA_A0_MM = 600;
/** Limite de cada faixa, em proporção do comprimento padrão (no A1: 105 cm e 120 cm). */
export const FAIXAS_MAIS: ReadonlyArray<{ plus: number; ate: number }> = [
  { plus: 1, ate: 1050 / 841 },
  { plus: 2, ate: 1200 / 841 },
];
/** Acima deste preenchimento (%) o valor fica para preencher à mão. */
export const LIMITE_PREENCHIMENTO = 45;
/**
 * O navegador suaviza as bordas das linhas e conta, em média, 2 pontos a mais
 * de tinta que o executável (teste da etapa 1, 9 PDFs reais). Descontamos aqui.
 */
export const DESCONTO_PREENCHIMENTO = 2;

export type MotivoManual = 'tamanho fora da tabela' | 'preenchimento acima de 45%';

export interface Classificacao {
  formato: NomeFormato;
  /** Quantos "+" o nome leva (0, 1 ou 2). */
  plus: number;
  /** Comprimento passou do último "+" da tabela. */
  acimaDaTabela: boolean;
  /** Nome como aparece na tabela de valores, sem a cor (ex.: "A1 ++"). */
  nomeTabela: string;
  /** Preenchimento já com o desconto, em %. null quando não foi medido. */
  preenchimento: number | null;
  manual: MotivoManual | null;
}

/** Aplica o desconto do navegador e mantém o valor entre 0 e 100. */
export function corrigirPreenchimento(bruto: number): number {
  return Math.min(100, Math.max(0, bruto - DESCONTO_PREENCHIMENTO));
}

export function classificarFolha(larguraMm: number, alturaMm: number, preenchimento: number | null): Classificacao {
  const larg = Math.min(larguraMm, alturaMm);
  const comp = Math.max(larguraMm, alturaMm);

  const [formato, , compPadrao] =
    larg > LARGURA_A0_MM
      ? FORMATOS_A[FORMATOS_A.length - 1]
      : (FORMATOS_A.find(([, l]) => larg <= l + TOL_LARGURA_MM) ?? FORMATOS_A[FORMATOS_A.length - 1]);

  let plus = 0;
  let acimaDaTabela = false;
  if (comp > compPadrao + TOL_COMPRIMENTO_MM) {
    const faixa = FAIXAS_MAIS.find(f => comp <= compPadrao * f.ate);
    if (faixa) plus = faixa.plus;
    else acimaDaTabela = true;
  }

  const nomeTabela = `${formato}${plus ? ` ${'+'.repeat(plus)}` : ''}`;
  let manual: MotivoManual | null = null;
  if (acimaDaTabela) manual = 'tamanho fora da tabela';
  else if (preenchimento != null && preenchimento > LIMITE_PREENCHIMENTO) manual = 'preenchimento acima de 45%';

  return { formato, plus, acimaDaTabela, nomeTabela, preenchimento, manual };
}

/** Texto curto para a tela: "A1 ++", "A1 · 150 cm (acima do ++)". */
export function rotuloFormato(c: Classificacao, comprimentoMm: number): string {
  if (!c.acimaDaTabela) return c.nomeTabela;
  return `${c.formato} · ${formatarCm(comprimentoMm)} cm (acima do ++)`;
}

export function formatarCm(mm: number): string {
  return (mm / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

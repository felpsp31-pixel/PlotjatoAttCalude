import type { Transacao } from './extratoBancario';

// Cruza as entradas do extrato com os lançamentos de clientes do Financeiro.
// Nada é gravado aqui: só sugere. Quem dá a baixa é o usuário, na tela.

export interface LancamentoConf {
  id: string;
  entityId: string;
  entityName: string;
  description: string;
  value: number;
  dueDate: string;
  status: 'open' | 'paid' | 'overdue';
}

export interface EntidadeConf {
  id: string;
  name: string;
  /** CNPJ ou CPF, com ou sem máscara. */
  document?: string;
}

export type Confianca = 'alta' | 'media' | 'baixa';

export interface Sugestao {
  /** Lançamentos sugeridos (mais de um quando o cliente pagou várias faturas juntas). */
  lancamentos: LancamentoConf[];
  confianca: Confianca;
  /** Texto curto explicando por que casou. */
  motivos: string[];
  /** Valor do extrato menor que o total dos lançamentos (retenção de imposto, desconto). */
  valorMenor: boolean;
  pontos: number;
}

export interface ResultadoTransacao {
  transacao: Transacao;
  /** Melhor sugestão (null = nada parecido). */
  melhor: Sugestao | null;
  /** Outras opções, da mais para a menos provável. */
  alternativas: Sugestao[];
  /** O melhor candidato já consta como pago: provável extrato repetido. */
  jaPago: boolean;
}

const PALAVRAS_VAZIAS = new Set([
  'LTDA', 'ME', 'EPP', 'EIRELI', 'SA', 'S', 'A', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM', 'COM',
  'PIX', 'TED', 'DOC', 'TRANSF', 'TRANSFERENCIA', 'RECEBIDO', 'RECEBIDA', 'RECEBIMENTO', 'PAGAMENTO',
  'PAG', 'CRED', 'CREDITO', 'DEP', 'DEPOSITO', 'ENVIADO', 'ENVIADA', 'REM', 'DEST', 'BANCO', 'CONTA',
  'CNPJ', 'CPF', 'AG', 'CC', 'MP', 'CHAVE', 'QRCODE', 'QR', 'CODE', 'BOLETO', 'COBRANCA', 'FAT', 'NF',
]);

export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const palavrasDoNome = (s: string): string[] =>
  normalizar(s).split(' ').filter(p => p.length >= 3 && !PALAVRAS_VAZIAS.has(p) && !/^\d+$/.test(p));

const soDigitos = (s: string) => s.replace(/\D/g, '');
const centavos = (v: number) => Math.round(v * 100);

/** Quanto a descrição do extrato "parece" o cliente: 0 a 1 (1 = documento batendo). */
export function semelhanca(descricao: string, ent: EntidadeConf): { nota: number; motivo?: string } {
  const digitos = soDigitos(descricao);
  const doc = soDigitos(ent.document ?? '');
  if (doc.length === 14 && digitos.includes(doc)) return { nota: 1, motivo: 'CNPJ confere' };
  if (doc.length === 11) {
    if (digitos.includes(doc)) return { nota: 1, motivo: 'CPF confere' };
    // PIX mostra o CPF mascarado (***.456.789-**): sobram só os 6 dígitos do meio.
    if (/\*|•|X{2,}/i.test(descricao) && digitos.includes(doc.slice(3, 9))) return { nota: 0.9, motivo: 'CPF (parcial) confere' };
  }
  const a = palavrasDoNome(ent.name);
  const b = new Set(palavrasDoNome(descricao));
  if (a.length === 0 || b.size === 0) return { nota: 0 };
  const em = a.filter(p => b.has(p) || [...b].some(q => q.length >= 5 && p.length >= 5 && (q.startsWith(p) || p.startsWith(q))));
  if (em.length === 0) return { nota: 0 };
  // Pelo menos metade das palavras do nome do cliente aparece no extrato.
  const cobertura = em.length / a.length;
  if (cobertura < 0.5 && em.length < 2) return { nota: 0.2, motivo: 'nome parecido' };
  return { nota: Math.min(0.85, 0.4 + cobertura * 0.45), motivo: 'nome confere' };
}

const MAX_COMBINADOS = 14;

/** Subconjuntos (até 4 itens) de lançamentos do mesmo cliente cuja soma é exatamente `alvo`. */
function combinacoes(lista: LancamentoConf[], alvo: number): LancamentoConf[][] {
  const itens = [...lista].sort((a, b) => b.value - a.value).slice(0, MAX_COMBINADOS);
  const achadas: LancamentoConf[][] = [];
  const buscar = (inicio: number, atual: LancamentoConf[], soma: number) => {
    if (achadas.length >= 5) return;
    if (atual.length >= 2 && soma === alvo) { achadas.push([...atual]); return; }
    if (atual.length >= 4 || soma >= alvo) return;
    for (let i = inicio; i < itens.length; i++) {
      buscar(i + 1, [...atual, itens[i]], soma + centavos(itens[i].value));
    }
  };
  buscar(0, [], 0);
  return achadas;
}

const diasEntre = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);

export function conferirTransacao(
  t: Transacao,
  lancamentos: LancamentoConf[],
  entidades: EntidadeConf[],
): ResultadoTransacao {
  const porId = new Map(entidades.map(e => [e.id, e]));
  const alvo = centavos(t.valor);
  const sugestoes: Sugestao[] = [];

  // Agrupa por cliente: o nome do cliente decide quem é o candidato.
  const porCliente = new Map<string, LancamentoConf[]>();
  for (const l of lancamentos) porCliente.set(l.entityId, [...(porCliente.get(l.entityId) ?? []), l]);

  for (const [entityId, lista] of porCliente) {
    const ent = porId.get(entityId) ?? { id: entityId, name: lista[0].entityName };
    const sem = semelhanca(t.descricao, ent);

    const montar = (ls: LancamentoConf[], pontosBase: number, motivos: string[], valorMenor: boolean) => {
      const prox = Math.min(...ls.map(l => diasEntre(t.data, l.dueDate)));
      let pontos = pontosBase + sem.nota * 40;
      if (sem.motivo) motivos.push(sem.motivo);
      if (prox <= 15) { pontos += 6; motivos.push('perto do vencimento'); }
      else if (prox <= 45) pontos += 2;
      // Lançamento em aberto vale mais que um já pago (a mesma conta pode repetir).
      if (ls.every(l => l.status === 'paid')) pontos -= 3;
      sugestoes.push({ lancamentos: ls, confianca: 'baixa', motivos, valorMenor, pontos });
    };

    for (const l of lista) {
      const v = centavos(l.value);
      if (v === alvo) montar([l], 50, ['valor igual'], false);
      // Pagou um pouco menos (retenção de ISS/IR costuma tirar até uns 12%): só com nome batendo.
      else if (sem.nota >= 0.4 && alvo < v && alvo >= v * 0.86) montar([l], 18, ['valor um pouco menor (retenção?)'], true);
    }
    // Várias faturas pagas de uma vez (só faz sentido com nome batendo).
    if (sem.nota >= 0.4) {
      const abertos = lista.filter(l => l.status !== 'paid');
      for (const combo of combinacoes(abertos, alvo)) montar(combo, 42, [`soma de ${combo.length} lançamentos`], false);
    }
  }

  sugestoes.sort((a, b) => b.pontos - a.pontos);
  // Descarta repetidas (mesmo conjunto de lançamentos).
  const vistas = new Set<string>();
  const unicas = sugestoes.filter(s => {
    const k = s.lancamentos.map(l => l.id).sort().join('|');
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });

  // Alta: valor exato + cliente reconhecido + sem concorrente parecido.
  // Média: o cliente confere, mas há dúvida (valor menor, ou outro lançamento igual).
  // Baixa: só o valor bate; nada indica de quem é.
  const segunda = unicas[1]?.pontos ?? -Infinity;
  unicas.forEach((s, i) => {
    const clienteConfere = s.motivos.some(m => /confere/.test(m));
    if (clienteConfere && !s.valorMenor && i === 0 && s.pontos - segunda >= 15) s.confianca = 'alta';
    else if (clienteConfere) s.confianca = 'media';
    else s.confianca = 'baixa';
  });

  const relevantes = unicas.filter(s => s.pontos >= 30);
  const melhor = relevantes[0] ?? null;
  return {
    transacao: t,
    melhor,
    alternativas: relevantes.slice(1, 6),
    jaPago: !!melhor && melhor.lancamentos.every(l => l.status === 'paid'),
  };
}

/** Confere todas as entradas do extrato; cada lançamento é sugerido uma única vez. */
export function conferirExtrato(
  transacoes: Transacao[],
  lancamentos: LancamentoConf[],
  entidades: EntidadeConf[],
): { entradas: ResultadoTransacao[]; saidasIgnoradas: number } {
  const entradas = transacoes.filter(t => t.valor > 0).sort((a, b) => a.data.localeCompare(b.data));
  const resultados = entradas.map(t => conferirTransacao(t, lancamentos, entidades));

  // Se dois pagamentos disputam o mesmo lançamento, fica com o de maior confiança.
  const ordem: Record<Confianca, number> = { alta: 0, media: 1, baixa: 2 };
  const dono = new Map<string, ResultadoTransacao>();
  [...resultados].sort((a, b) =>
    (a.melhor ? ordem[a.melhor.confianca] : 9) - (b.melhor ? ordem[b.melhor.confianca] : 9)
    || (b.melhor?.pontos ?? 0) - (a.melhor?.pontos ?? 0),
  ).forEach(r => {
    if (!r.melhor || r.jaPago) return;
    const ids = r.melhor.lancamentos.map(l => l.id);
    if (ids.some(id => dono.has(id))) {
      // O lançamento já é de outro pagamento: este passa a ser só uma opção.
      const alt = r.melhor;
      r.alternativas = [alt, ...r.alternativas];
      r.melhor = r.alternativas.find(a => !a.lancamentos.some(l => dono.has(l.id))) ?? null;
      r.alternativas = r.alternativas.filter(a => a !== r.melhor);
    }
    if (r.melhor) r.melhor.lancamentos.forEach(l => dono.set(l.id, r));
  });

  return { entradas: resultados, saidasIgnoradas: transacoes.length - entradas.length };
}

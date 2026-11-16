// Leitura de extrato bancário (OFX ou CSV) exportado pelo próprio banco.
// Tudo roda no navegador: o arquivo não é enviado nem guardado em lugar nenhum.

export interface Transacao {
  /** Identificador estável dentro do arquivo (FITID, quando existe, ou a linha). */
  id: string;
  /** Data do lançamento, AAAA-MM-DD. */
  data: string;
  /** Positivo = entrada (crédito), negativo = saída (débito). */
  valor: number;
  descricao: string;
}

export class ExtratoInvalido extends Error {}

/** Converte o arquivo em texto; bancos brasileiros costumam exportar em windows-1252. */
export function decodificar(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** "1.234,56", "1234.56", "-R$ 10,00", "(10,00)", "10,00-" → número. */
export function lerValor(bruto: string): number | null {
  let t = bruto.trim().replace(/R\$\s*/i, '').replace(/\s+/g, '');
  if (!t) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(t)) { negativo = true; t = t.slice(1, -1); }
  if (t.startsWith('-')) { negativo = !negativo; t = t.slice(1); }
  else if (t.startsWith('+')) t = t.slice(1);
  if (t.endsWith('-')) { negativo = !negativo; t = t.slice(0, -1); }
  if (/[a-z]/i.test(t)) return null;
  const ultimaVirgula = t.lastIndexOf(',');
  const ultimoPonto = t.lastIndexOf('.');
  if (ultimaVirgula > ultimoPonto) t = t.replace(/\./g, '').replace(',', '.'); // 1.234,56
  else if (ultimoPonto > ultimaVirgula) {
    // 1234.56 (decimal) ou 1.234 / 1.234.567 (milhar)
    const depois = t.length - ultimoPonto - 1;
    if (ultimaVirgula === -1 && (depois === 3 && /^\d{1,3}(\.\d{3})+$/.test(t))) t = t.replace(/\./g, '');
    else t = t.replace(/,/g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** "12/11/2026", "12/11/26", "2026-11-12", "20261112…" → AAAA-MM-DD. */
export function lerData(bruto: string): string | null {
  const t = bruto.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return valida(m[1], m[2], m[3]);
  m = t.match(/^(\d{4})(\d{2})(\d{2})(?:\d|\[|$)/);
  if (m) return valida(m[1], m[2], m[3]);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (m) return valida(m[3].length === 2 ? `20${m[3]}` : m[3], m[2].padStart(2, '0'), m[1].padStart(2, '0'));
  return null;
}

function valida(a: string, m: string, d: string): string | null {
  const ano = Number(a), mes = Number(m), dia = Number(d);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 2000 || ano > 2100) return null;
  return `${a}-${m}-${d}`;
}

// ---------------- OFX ----------------

function tag(bloco: string, nome: string): string {
  // OFX 1.x (SGML) não fecha as tags: o valor vai até a próxima "<" ou quebra de linha.
  const m = bloco.match(new RegExp(`<${nome}>\\s*([^<\\r\\n]*)`, 'i'));
  return m ? m[1].trim() : '';
}

export function lerOFX(texto: string): Transacao[] {
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const saida: Transacao[] = [];
  blocos.forEach((b, i) => {
    const bloco = b.split(/<\/STMTTRN>/i)[0];
    const valor = lerValor(tag(bloco, 'TRNAMT'));
    const data = lerData(tag(bloco, 'DTPOSTED'));
    if (valor === null || !data) return;
    const descricao = [tag(bloco, 'NAME'), tag(bloco, 'MEMO')].filter(Boolean)
      .filter((x, k, arr) => arr.indexOf(x) === k).join(' - ');
    saida.push({ id: tag(bloco, 'FITID') || `ofx-${i}`, data, valor, descricao });
  });
  return saida;
}

// ---------------- CSV ----------------

function detectarSeparador(linhas: string[]): string {
  const amostra = linhas.slice(0, 15);
  let melhor = ';', melhorPontos = -1;
  for (const sep of [';', '\t', ',']) {
    const contagens = amostra.map(l => dividirLinha(l, sep).length).filter(n => n > 1);
    if (contagens.length === 0) continue;
    const pontos = contagens.length * 100 + Math.max(...contagens);
    if (pontos > melhorPontos) { melhorPontos = pontos; melhor = sep; }
  }
  return melhor;
}

export function dividirLinha(linha: string, sep: string): string[] {
  const campos: string[] = [];
  let atual = '', aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas;
    } else if (c === sep && !aspas) { campos.push(atual.trim()); atual = ''; }
    else atual += c;
  }
  campos.push(atual.trim());
  return campos;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Colunas { data: number; descricao: number[]; valor: number; credito: number; debito: number; tipo: number }

function mapear(cabecalho: string[]): Colunas | null {
  const h = cabecalho.map(semAcento);
  const achar = (...padroes: RegExp[]) => h.findIndex(x => padroes.some(p => p.test(x)));
  const data = achar(/^data/, /^dt/, /\bdata\b/, /^date/);
  const credito = achar(/^credito/, /^entrada/, /^credit/);
  const debito = achar(/^debito/, /^saida/, /^debit/);
  const valor = achar(/^valor/, /^amount/, /^quantia/, /^montante/);
  const tipo = achar(/^tipo/, /^natureza/, /^d\/c$/, /^dc$/);
  const descricao = h.map((x, i) => (/(descri|historico|lancamento|memo|nome|favorecido|identificacao|detalhe|origem|contraparte)/.test(x) ? i : -1))
    .filter(i => i >= 0 && i !== data && i !== valor && i !== credito && i !== debito && i !== tipo);
  if (data < 0 || (valor < 0 && credito < 0 && debito < 0)) return null;
  return { data, descricao, valor, credito, debito, tipo };
}

export function lerCSV(texto: string): Transacao[] {
  const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return [];
  const sep = detectarSeparador(linhas);
  const matriz = linhas.map(l => dividirLinha(l, sep));

  // O cabeçalho pode vir depois de linhas de título do banco ("Extrato conta corrente…").
  let idxCab = -1, cols: Colunas | null = null;
  for (let i = 0; i < Math.min(matriz.length, 25); i++) {
    const c = mapear(matriz[i]);
    if (c) { idxCab = i; cols = c; break; }
  }

  const saida: Transacao[] = [];
  if (cols) {
    const c = cols;
    matriz.slice(idxCab + 1).forEach((linha, n) => {
      const data = lerData(linha[c.data] ?? '');
      if (!data) return;
      let valor: number | null = null;
      if (c.valor >= 0) {
        valor = lerValor(linha[c.valor] ?? '');
        // Coluna "Tipo/D-C" separada: débito inverte o sinal.
        const tipo = semAcento(linha[c.tipo] ?? '');
        if (valor !== null && c.tipo >= 0 && /^(d|deb|debito|saida)/.test(tipo)) valor = -Math.abs(valor);
        if (valor !== null && c.tipo >= 0 && /^(c|cred|credito|entrada)/.test(tipo)) valor = Math.abs(valor);
      } else {
        const cr = c.credito >= 0 ? lerValor(linha[c.credito] ?? '') : null;
        const de = c.debito >= 0 ? lerValor(linha[c.debito] ?? '') : null;
        if (cr === null && de === null) return;
        valor = Math.abs(cr ?? 0) - Math.abs(de ?? 0);
      }
      if (valor === null || valor === 0) return;
      const descricao = (c.descricao.length ? c.descricao : linha.map((_, i) => i).filter(i => i !== c.data && i !== c.valor && i !== c.credito && i !== c.debito))
        .map(i => linha[i] ?? '').filter(x => x && lerValor(x) === null).join(' - ');
      saida.push({ id: `csv-${idxCab + 2 + n}`, data, valor, descricao });
    });
    return saida;
  }

  // Sem cabeçalho: procura uma coluna de data e uma de valor pelo conteúdo.
  const amostra = matriz.slice(0, 20);
  const largura = Math.max(...amostra.map(l => l.length));
  const pontua = (i: number, teste: (s: string) => boolean) => amostra.filter(l => l[i] && teste(l[i])).length;
  let ci = -1, cv = -1, bd = 0, bv = 0;
  for (let i = 0; i < largura; i++) {
    const d = pontua(i, s => lerData(s) !== null);
    const v = pontua(i, s => lerData(s) === null && lerValor(s) !== null && /[,.]\d{2}$/.test(s.trim()));
    if (d > bd) { bd = d; ci = i; }
    if (v > bv) { bv = v; cv = i; }
  }
  if (ci < 0 || cv < 0) return [];
  matriz.forEach((linha, n) => {
    const data = lerData(linha[ci] ?? '');
    const valor = lerValor(linha[cv] ?? '');
    if (!data || valor === null || valor === 0) return;
    const descricao = linha.filter((x, i) => i !== ci && i !== cv && x && lerValor(x) === null).join(' - ');
    saida.push({ id: `csv-${n + 1}`, data, valor, descricao });
  });
  return saida;
}

/** Lê OFX ou CSV (detecta pelo conteúdo). Lança ExtratoInvalido se não achar lançamentos. */
export function lerExtrato(texto: string): Transacao[] {
  const t = /<OFX>|<STMTTRN>/i.test(texto) ? lerOFX(texto) : lerCSV(texto);
  if (t.length === 0) {
    throw new ExtratoInvalido('Não encontrei lançamentos neste arquivo. Use o extrato em OFX ou CSV exportado pelo banco.');
  }
  return t;
}

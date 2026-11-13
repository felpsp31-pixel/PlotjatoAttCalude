import type { Cliente, Solicitante, Obra, Recibo, EmpresaInfo } from '@/types/recibos';

// Recibo: A5 horizontal (210 x 148 mm) com duas vias idênticas lado a lado (105 mm cada).
// Orçamento: uma via só, em A5 retrato (148 x 210 mm). A via do recibo é meia A5
// deitada (105 x 148); a do orçamento é a mesma via ampliada para a largura da folha
// (148 / 105), então fontes, espaços e colunas crescem juntos e o desenho fica igual.
const VIA_W = 105;
const PAD = 5;

/** "Prazo: 1 dia útil" / "Prazo: 5 dias úteis". */
export const textoPrazo = (dias: number) => `Prazo: ${dias} ${dias === 1 ? 'dia útil' : 'dias úteis'}`;

/** Descrição do item no PDF, com o prazo numa linha abaixo quando houver. */
export const descricaoComPrazo = (l: { description: string; prazoDiasUteis?: number }) =>
  l.prazoDiasUteis && l.prazoDiasUteis > 0 ? `${l.description}\n${textoPrazo(l.prazoDiasUteis)}` : l.description;

const formatDate = (date: string) => {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
};

const num = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface ReciboPdfContext {
  cliente?: Cliente;
  solicitante?: Solicitante;
  obra?: Pick<Obra, 'name'>;
  empresaInfo: EmpresaInfo;
  isPago?: boolean;
  /** 'orcamento' imprime ORÇAMENTO sem número, sem carimbo nem assinatura. */
  tipo?: 'recibo' | 'orcamento';
  /** Forma de pagamento impressa sob o carimbo PAGO: PIX, Dinheiro ou Cartão. */
  formaPagamento?: string;
  /** Rótulo do desconto, ex.: "Desconto (10%):". Padrão: "Desconto:" */
  descontoLabel?: string;
}

/**
 * Nome do arquivo PDF: "Numeração - Cliente - Obra"
 * A obra é omitida quando o recibo não tem obra vinculada.
 */
export const buildReciboFileName = (
  r: Recibo,
  ctx: Pick<ReciboPdfContext, 'cliente' | 'obra' | 'tipo'>,
) => {
  const clienteName = ctx.cliente?.name || r.clienteAvulso || 'Cliente Avulso';
  const parts = [ctx.tipo === 'orcamento' ? 'Orçamento' : r.number, clienteName];
  if (ctx.obra?.name) parts.push(ctx.obra.name);
  const safe = parts
    .join(' - ')
    .replace(/[\\/:*?"<>|]/g, '-') // caracteres inválidos em nome de arquivo
    .replace(/\s+/g, ' ')
    .trim();
  return `${safe}.pdf`;
};

/** "CPF" quando o documento tem 11 dígitos; "CNPJ" nos outros casos. */
export const rotuloDocumento = (doc: string) => (doc.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ');

/**
 * Linhas de dados do cliente abaixo do nome. O orçamento mostra tudo o que foi
 * preenchido (documento, telefone, e-mail, solicitante com telefone, obra); o
 * recibo mantém o resumo de sempre. Campo vazio não gera linha.
 */
export const linhasCliente = ({ cliente, solicitante, obra, orcamento }: {
  cliente?: Pick<Cliente, 'cnpj' | 'phone' | 'email'>;
  solicitante?: Pick<Solicitante, 'name' | 'phone'>;
  obra?: Pick<Obra, 'name'>;
  orcamento: boolean;
}): string[] => {
  const v = (s?: string) => (s ?? '').trim();
  const info: string[] = [];
  const documento = v(cliente?.cnpj);
  if (documento) info.push(`${rotuloDocumento(documento)}: ${documento}`);
  if (orcamento) {
    const contato = [v(cliente?.phone) && `Telefone: ${v(cliente?.phone)}`, v(cliente?.email) && `E-mail: ${v(cliente?.email)}`].filter(Boolean);
    if (contato.length) info.push(contato.join('   '));
  }
  if (v(solicitante?.name)) {
    const tel = orcamento ? v(solicitante?.phone) : '';
    info.push(`Solicitante: ${v(solicitante?.name)}${tel ? ` · ${tel}` : ''}`);
  }
  if (v(obra?.name)) info.push(`Obra: ${v(obra?.name)}`);
  return info;
};

export const generateReciboPdf = async (r: Recibo, ctx: ReciboPdfContext) => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const { cliente, solicitante, obra, empresaInfo, isPago, formaPagamento, tipo } = ctx;
  const orcamento = tipo === 'orcamento';

  const doc = new jsPDF({ orientation: orcamento ? 'portrait' : 'landscape', unit: 'mm', format: 'a5' });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const clienteName = cliente?.name || r.clienteAvulso || 'Cliente Avulso';

  const subtotal = r.lines.reduce((s, l) => s + l.total, 0);
  const descValue = subtotal - r.total;
  const hasDesc = descValue > 0.001;
  const descLabel = ctx.descontoLabel || 'Desconto:';

  // Carrega a logo uma única vez e reutiliza nas duas vias
  let logo: { data: string; fmt: string; w: number; h: number } | null = null;
  if (empresaInfo.logo && empresaInfo.logo.startsWith('data:image/')) {
    try {
      const mimeMatch = empresaInfo.logo.match(/^data:image\/([a-zA-Z]+)/);
      const ext = (mimeMatch?.[1] || 'png').toLowerCase();
      const fmt = ext === 'jpg' || ext === 'jpeg' ? 'JPEG' : ext === 'webp' ? 'WEBP' : 'PNG';
      const img = new Image();
      img.src = empresaInfo.logo;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('logo load failed'));
      });
      const maxW = 24, maxH = 13; // tamanho na via do recibo; o orçamento amplia na hora de desenhar
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      logo = { data: empresaInfo.logo, fmt, w: img.width * ratio, h: img.height * ratio };
    } catch (e) {
      console.warn('Falha ao adicionar logo ao PDF:', e);
    }
  }

  // Desenha uma via completa a partir da borda esquerda x0; k amplia tudo (1 no recibo).
  const drawCopy = (x0: number, k: number) => {
    const left = x0 + PAD * k;
    const right = x0 + VIA_W * k - PAD * k;
    const innerW = right - left;
    const fs = (pt: number) => doc.setFontSize(pt * k);
    let y = 9 * k;
    const logoW = (logo?.w ?? 0) * k, logoH = (logo?.h ?? 0) * k;

    let headerW = innerW;
    if (logo) {
      doc.addImage(logo.data, logo.fmt, right - logoW, 6 * k, logoW, logoH);
      headerW = innerW - logoW - 2 * k;
    }

    doc.setFont('helvetica', 'bold');
    fs(9);
    doc.text(doc.splitTextToSize(empresaInfo.name, headerW)[0] ?? '', left, y);
    y += 3.6 * k;

    doc.setFont('helvetica', 'normal');
    fs(5.8);
    if (empresaInfo.cnpj) { doc.text(`CNPJ: ${empresaInfo.cnpj}`, left, y); y += 2.8 * k; }
    if (empresaInfo.address) {
      doc.splitTextToSize(empresaInfo.address, headerW).slice(0, 2).forEach((t: string) => {
        doc.text(t, left, y); y += 2.8 * k;
      });
    }
    const contact = [empresaInfo.phone, empresaInfo.email].filter(Boolean).join(' | ');
    if (contact) {
      doc.text(doc.splitTextToSize(contact, headerW)[0], left, y);
      y += 2.8 * k;
    }

    y = Math.max(y, 6 * k + logoH + 2.5 * k);
    doc.setDrawColor(170);
    doc.setLineWidth(0.2);
    doc.line(left, y, right, y);
    y += 5 * k;

    doc.setFont('helvetica', 'bold');
    fs(10);
    doc.text(orcamento ? 'ORÇAMENTO' : `RECIBO Nº ${r.number}`, left, y);
    doc.setFont('helvetica', 'normal');
    fs(6.5);
    doc.text(formatDate(r.date), right, y, { align: 'right' });
    y += 4.6 * k;

    // O nome do cliente sai 50% maior que o resto: e o que se procura
    // primeiro no recibo, de longe.
    const TAM_INFO = 6.5;
    const TAM_CLIENTE = TAM_INFO * 1.5;
    const rotulo = 'Cliente: ';
    fs(TAM_INFO);
    doc.text(rotulo, left, y);
    const xNome = left + doc.getTextWidth(rotulo);
    fs(TAM_CLIENTE);
    const linhasNome: string[] = doc.splitTextToSize(clienteName, innerW - (xNome - left));
    doc.text(linhasNome[0] ?? '', xNome, y);
    linhasNome.slice(1).forEach((t: string) => { y += 4 * k; doc.text(t, left, y); });
    y += 4 * k;

    fs(TAM_INFO);
    const info = linhasCliente({ cliente, solicitante, obra, orcamento });
    info.forEach(txt => {
      doc.splitTextToSize(txt, innerW).forEach((t: string) => { doc.text(t, left, y); y += 3 * k; });
    });
    y += 1.5 * k;

    autoTable(doc, {
      startY: y,
      margin: { left, right: PAGE_W - right },
      tableWidth: innerW,
      head: [['Cód', 'Descrição', 'Qtd', 'Unit.', 'Total']],
      body: r.lines.map(l => [
        l.serviceCode.replace(/^CS:/, ''), // código da tabela própria do cliente sem o prefixo interno
        descricaoComPrazo(l),
        String(l.quantity),
        num(l.unitPrice),
        num(l.total),
      ]),
      theme: 'grid',
      styles: {
        fontSize: 5.6 * k,
        cellPadding: 0.9 * k,
        overflow: 'linebreak',
        lineWidth: 0.1,
        lineColor: [200, 200, 200],
      },
      headStyles: { fontSize: 5.6 * k, fillColor: [70, 70, 70], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 13 * k },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 8 * k, halign: 'right' },
        3: { cellWidth: 15 * k, halign: 'right' },
        4: { cellWidth: 16 * k, halign: 'right' },
      },
    });

    let cy = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20 * k) + 4 * k;

    fs(6.5);
    if (hasDesc) {
      doc.text('Subtotal:', right - 30 * k, cy);
      doc.text(num(subtotal), right, cy, { align: 'right' });
      cy += 3.2 * k;
      doc.text(descLabel, right - 30 * k, cy);
      doc.text(`-${num(descValue)}`, right, cy, { align: 'right' });
      cy += 3.8 * k;
    }
    doc.setFont('helvetica', 'bold');
    fs(9);
    doc.text('TOTAL:', right - 32 * k, cy);
    doc.text(brl(r.total), right, cy, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    cy += 5 * k;

    // Assinatura / carimbo ancorados na base da via, para a metade não ficar vazia
    if (orcamento) {
      const notaY = Math.min(Math.max(cy + 12 * k, PAGE_H - 16 * k), PAGE_H - 9 * k);
      fs(6.5);
      doc.setTextColor(110);
      doc.text('Orçamento sujeito a confirmação. Este documento não é recibo e não comprova pagamento.', left + innerW / 2, notaY, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    } else if (!isPago && (r.valorSinal ?? 0) > 0) {
      const sinal = Math.min(r.valorSinal as number, r.total);
      const stampY = Math.min(Math.max(cy + 12 * k, PAGE_H - 26 * k), PAGE_H - 12 * k);
      doc.setFont('helvetica', 'bold');
      fs(18);
      doc.setTextColor(217, 119, 6);
      doc.text('SINAL', left + innerW / 2, stampY, { align: 'center' });
      fs(8);
      const forma = formaPagamento ? ` (${formaPagamento})` : '';
      doc.text(`Pago: ${brl(sinal)}${forma}  ·  Falta: ${brl(r.total - sinal)}`, left + innerW / 2, Math.min(stampY + 4.5 * k, PAGE_H - 6 * k), { align: 'center' });
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    } else if (!isPago && !r.clienteId) {
      // Avulso com "Pagamento no ato": paga quando retirar, sem assinatura.
      const stampY = Math.min(Math.max(cy + 12 * k, PAGE_H - 26 * k), PAGE_H - 12 * k);
      doc.setFont('helvetica', 'bold');
      fs(16);
      doc.setTextColor(37, 99, 235);
      doc.text('PAGAMENTO NA RETIRADA', left + innerW / 2, stampY, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    } else if (isPago) {
      const stampY = Math.min(Math.max(cy + 12 * k, PAGE_H - 26 * k), PAGE_H - 12 * k);
      doc.setFont('helvetica', 'bold');
      fs(22);
      doc.setTextColor(220, 38, 38);
      doc.text('PAGO', left + innerW / 2, stampY, { align: 'center' });
      if (formaPagamento) {
        fs(8);
        doc.text(`Forma de pagamento: ${formaPagamento}`, left + innerW / 2, Math.min(stampY + 4.5 * k, PAGE_H - 6 * k), { align: 'center' });
      }
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    } else {
      const signY = Math.min(Math.max(cy + 12 * k, PAGE_H - 20 * k), PAGE_H - 11 * k);
      doc.setDrawColor(120);
      doc.setLineWidth(0.2);
      doc.line(left + 10 * k, signY, right - 10 * k, signY);
      fs(5.5);
      doc.text('Assinatura', left + innerW / 2, signY + 3.2 * k, { align: 'center' });
    }
  };

  if (orcamento) {
    // Orçamento não precisa de via do cliente: uma via só, ocupando a folha.
    drawCopy(0, PAGE_W / VIA_W);
  } else {
    drawCopy(0, 1);
    drawCopy(VIA_W, 1);

    // Linha de corte central entre as duas vias
    doc.setDrawColor(150);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(VIA_W, 4, VIA_W, PAGE_H - 4);
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(0);
  }

  return doc;
};

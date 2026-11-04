import type { Cliente, Solicitante, Obra, Recibo, EmpresaInfo } from '@/types/recibos';

// A5 horizontal (210 x 148 mm) com duas vias idênticas lado a lado (105 mm cada)
const PAGE_W = 210;
const PAGE_H = 148;
const HALF = PAGE_W / 2;
const PAD = 5;

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
  obra?: Obra;
  empresaInfo: EmpresaInfo;
  isPago?: boolean;
  /** Rótulo do desconto, ex.: "Desconto (10%):". Padrão: "Desconto:" */
  descontoLabel?: string;
}

/**
 * Nome do arquivo PDF: "Numeração - Cliente - Obra"
 * A obra é omitida quando o recibo não tem obra vinculada.
 */
export const buildReciboFileName = (
  r: Recibo,
  ctx: Pick<ReciboPdfContext, 'cliente' | 'obra'>,
) => {
  const clienteName = ctx.cliente?.name || r.clienteAvulso || 'Cliente Avulso';
  const parts = [r.number, clienteName];
  if (ctx.obra?.name) parts.push(ctx.obra.name);
  const safe = parts
    .join(' - ')
    .replace(/[\\/:*?"<>|]/g, '-') // caracteres inválidos em nome de arquivo
    .replace(/\s+/g, ' ')
    .trim();
  return `${safe}.pdf`;
};

export const generateReciboPdf = async (r: Recibo, ctx: ReciboPdfContext) => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });

  const { cliente, solicitante, obra, empresaInfo, isPago } = ctx;
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
      const maxW = 24, maxH = 13;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      logo = { data: empresaInfo.logo, fmt, w: img.width * ratio, h: img.height * ratio };
    } catch (e) {
      console.warn('Falha ao adicionar logo ao PDF:', e);
    }
  }

  // Desenha uma via completa a partir da borda esquerda x0
  const drawCopy = (x0: number) => {
    const left = x0 + PAD;
    const right = x0 + HALF - PAD;
    const innerW = HALF - 2 * PAD;
    let y = 9;

    let headerW = innerW;
    if (logo) {
      doc.addImage(logo.data, logo.fmt, right - logo.w, 6, logo.w, logo.h);
      headerW = innerW - logo.w - 2;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(empresaInfo.name, headerW)[0] ?? '', left, y);
    y += 3.6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    if (empresaInfo.cnpj) { doc.text(`CNPJ: ${empresaInfo.cnpj}`, left, y); y += 2.8; }
    if (empresaInfo.address) {
      doc.splitTextToSize(empresaInfo.address, headerW).slice(0, 2).forEach((t: string) => {
        doc.text(t, left, y); y += 2.8;
      });
    }
    const contact = [empresaInfo.phone, empresaInfo.email].filter(Boolean).join(' | ');
    if (contact) {
      doc.text(doc.splitTextToSize(contact, headerW)[0], left, y);
      y += 2.8;
    }

    y = Math.max(y, 6 + (logo?.h ?? 0) + 2.5);
    doc.setDrawColor(170);
    doc.setLineWidth(0.2);
    doc.line(left, y, right, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`RECIBO Nº ${r.number}`, left, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(formatDate(r.date), right, y, { align: 'right' });
    y += 4.6;

    const info: string[] = [
      `Cliente: ${clienteName}${cliente?.cnpj ? ` — CNPJ: ${cliente.cnpj}` : ''}`,
    ];
    if (solicitante) info.push(`Solicitante: ${solicitante.name}`);
    if (obra) info.push(`Obra: ${obra.name}`);
    info.forEach(txt => {
      doc.splitTextToSize(txt, innerW).forEach((t: string) => { doc.text(t, left, y); y += 3; });
    });
    y += 1.5;

    autoTable(doc, {
      startY: y,
      margin: { left, right: PAGE_W - right },
      tableWidth: innerW,
      head: [['Cód', 'Descrição', 'Qtd', 'Unit.', 'Total']],
      body: r.lines.map(l => [
        l.serviceCode,
        l.description,
        String(l.quantity),
        num(l.unitPrice),
        num(l.total),
      ]),
      theme: 'grid',
      styles: {
        fontSize: 5.6,
        cellPadding: 0.9,
        overflow: 'linebreak',
        lineWidth: 0.1,
        lineColor: [200, 200, 200],
      },
      headStyles: { fontSize: 5.6, fillColor: [70, 70, 70], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 13 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 8, halign: 'right' },
        3: { cellWidth: 15, halign: 'right' },
        4: { cellWidth: 16, halign: 'right' },
      },
    });

    let cy = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20) + 4;

    doc.setFontSize(6.5);
    if (hasDesc) {
      doc.text('Subtotal:', right - 30, cy);
      doc.text(num(subtotal), right, cy, { align: 'right' });
      cy += 3.2;
      doc.text(descLabel, right - 30, cy);
      doc.text(`-${num(descValue)}`, right, cy, { align: 'right' });
      cy += 3.8;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TOTAL:', right - 32, cy);
    doc.text(brl(r.total), right, cy, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    cy += 5;

    // Assinatura / carimbo ancorados na base da via, para a metade não ficar vazia
    if (isPago) {
      const stampY = Math.min(Math.max(cy + 12, PAGE_H - 26), PAGE_H - 12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(220, 38, 38);
      doc.text('PAGO', left + innerW / 2, stampY, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    } else {
      const signY = Math.min(Math.max(cy + 12, PAGE_H - 20), PAGE_H - 11);
      doc.setDrawColor(120);
      doc.setLineWidth(0.2);
      doc.line(left + 10, signY, right - 10, signY);
      doc.setFontSize(5.5);
      doc.text('Assinatura', left + innerW / 2, signY + 3.2, { align: 'center' });
    }
  };

  drawCopy(0);
  drawCopy(HALF);

  // Linha de corte central entre as duas vias
  doc.setDrawColor(150);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(HALF, 4, HALF, PAGE_H - 4);
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(0);

  return doc;
};

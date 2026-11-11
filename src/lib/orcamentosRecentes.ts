// Guarda os últimos orçamentos gerados neste computador para baixar de novo.
// O orçamento não vai para o banco (não tem número nem entra no financeiro);
// aqui ficam só os dados para refazer o PDF, no armazenamento do navegador.
import type { Cliente, Obra, Recibo, Solicitante } from '@/types/recibos';

export const LIMITE_ORCAMENTOS = 5;
const CHAVE = 'plotjato:orcamentos-recentes:v1';

export interface OrcamentoGuardado {
  id: string;
  /** Quando foi gerado (ISO). */
  geradoEm: string;
  doc: Recibo;
  cliente?: Cliente;
  solicitante?: Solicitante;
  obra?: Pick<Obra, 'name'>;
  descontoLabel?: string;
}

export function listarOrcamentos(): OrcamentoGuardado[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    const lista = bruto ? (JSON.parse(bruto) as OrcamentoGuardado[]) : [];
    return Array.isArray(lista) ? lista.filter(o => o && o.doc && Array.isArray(o.doc.lines)) : [];
  } catch {
    return [];
  }
}

/**
 * Coloca o orçamento no topo da lista e mantém só os 5 mais recentes. Se o mesmo
 * orçamento for exportado e depois impresso, entra uma vez só.
 */
export function guardarOrcamento(o: Omit<OrcamentoGuardado, 'id' | 'geradoEm'>, agora = new Date()): OrcamentoGuardado[] {
  const assinatura = JSON.stringify([o.doc.lines, o.doc.total, o.doc.clienteId, o.doc.clienteAvulso, o.doc.obraId, o.doc.obraAvulsa]);
  const novo: OrcamentoGuardado = { ...o, id: `${agora.getTime()}`, geradoEm: agora.toISOString() };
  const anteriores = listarOrcamentos().filter(x =>
    JSON.stringify([x.doc.lines, x.doc.total, x.doc.clienteId, x.doc.clienteAvulso, x.doc.obraId, x.doc.obraAvulsa]) !== assinatura);
  const lista = [novo, ...anteriores].slice(0, LIMITE_ORCAMENTOS);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // Armazenamento cheio ou bloqueado: o PDF já foi gerado, só não fica na lista.
  }
  return lista;
}

export interface Cliente {
  id: string;
  name: string;
  cnpj: string;
  phone: string;
  email: string;
}

export interface Solicitante {
  id: string;
  clienteId: string;
  name: string;
  phone: string;
}

export interface Obra {
  id: string;
  clienteId: string;
  name: string;
  hasDelivery: boolean;
  deliveryValue: number;
  exemptionValue: number;
}

export interface Servico {
  id: string;
  code: string;
  description: string;
  unitPrice: number;
  /** Aparece para todo cliente, inclusive os que têm tabela própria. */
  universal?: boolean;
  /** Serviço com desconto por quantidade (usa `faixas`). */
  descontoQtd?: boolean;
  faixas?: FaixaDesconto[];
}

/** A partir de `qtd` unidades, cada unidade custa `valor`. */
export interface FaixaDesconto {
  qtd: number;
  valor: number;
}

export interface ClientService {
  id: string;
  clienteId: string;
  code: string;
  description: string;
  unitPrice: number;
}

export interface LinhaRecibo {
  serviceCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  /** Só no orçamento: prazo do item em dias úteis, impresso abaixo da descrição. */
  prazoDiasUteis?: number;
  /** Só no orçamento: linha que veio da análise de arquivos (refeita se o cliente mudar). */
  importKey?: string;
}

export interface Recibo {
  id: string;
  number: string;
  date: string;
  clienteId: string;
  clienteAvulso?: string;
  /** Contato do avulso, guardado no recibo para a reimpressao sair igual. */
  clienteAvulsoTelefone?: string;
  clienteAvulsoDocumento?: string;
  solicitanteId: string;
  obraId: string;
  /** Obra digitada na hora, quando nao ha cadastro. */
  obraAvulsa?: string;
  lines: LinhaRecibo[];
  total: number;
  /** Pago no ato da emissao; entra no fechamento como ja recebido. */
  isPago?: boolean;
  formaPagamento?: string;
  /** Avulso que deu sinal: quanto já foi pago (o que falta é total - sinal). */
  valorSinal?: number;
}

export interface EmpresaInfo {
  name: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
}

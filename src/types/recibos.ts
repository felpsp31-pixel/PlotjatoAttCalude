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
}

export interface Recibo {
  id: string;
  number: string;
  date: string;
  clienteId: string;
  clienteAvulso?: string;
  solicitanteId: string;
  obraId: string;
  lines: LinhaRecibo[];
  total: number;
}

export interface EmpresaInfo {
  name: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
}

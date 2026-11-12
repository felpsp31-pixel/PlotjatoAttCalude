import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import type { Cliente, Solicitante, Obra, Servico, Recibo, EmpresaInfo, ClientService, FaixaDesconto } from '@/types/recibos';

function lerFaixas(v: unknown): FaixaDesconto[] {
  if (!Array.isArray(v)) return [];
  return v
    .map(f => ({ qtd: Number((f as FaixaDesconto)?.qtd), valor: Number((f as FaixaDesconto)?.valor) }))
    .filter(f => f.qtd > 0 && f.valor >= 0)
    .sort((a, b) => a.qtd - b.qtd);
}
import { toast } from 'sonner';
import {
  TAMANHO_BLOCO, REPOR_ABAIXO_DE, comTrava, guardarNumeros, lerCadastros, lerFila, linhaDoRecibo,
  marcarErro, numerosDisponiveis, porNaFila, salvarCadastros, semInternet, tirarDaFila, tirarNumero,
  type CadastrosOffline,
} from '@/lib/offlineRecibos';

interface MontanteCliente {
  clienteId: string;
  clienteName: string;
  cnpj: string;
  total: number;
}

interface RecibosContextType {
  empresaInfo: EmpresaInfo;
  setEmpresaInfo: (info: EmpresaInfo) => void;
  clientes: Cliente[];
  addCliente: (c: Omit<Cliente, 'id'>) => void;
  updateCliente: (id: string, c: Partial<Cliente>) => void;
  deleteCliente: (id: string) => void;
  solicitantes: Solicitante[];
  addSolicitante: (s: Omit<Solicitante, 'id'>) => void;
  updateSolicitante: (id: string, s: Partial<Solicitante>) => void;
  deleteSolicitante: (id: string) => void;
  obras: Obra[];
  addObra: (o: Omit<Obra, 'id'>) => void;
  updateObra: (id: string, o: Partial<Obra>) => void;
  deleteObra: (id: string) => void;
  servicos: Servico[];
  addServico: (s: Omit<Servico, 'id'>) => Promise<boolean>;
  updateServico: (id: string, s: Partial<Servico>) => Promise<boolean>;
  deleteServico: (id: string) => void;
  clientServices: ClientService[];
  addClientService: (s: Omit<ClientService, 'id'>) => Promise<boolean>;
  updateClientService: (id: string, s: Partial<ClientService>) => Promise<boolean>;
  deleteClientService: (id: string) => void;
  recibos: Recibo[];
  addRecibo: (r: Omit<Recibo, 'id' | 'number'>) => Promise<Recibo | null>;
  deleteRecibo: (id: string) => void;
  montantePorCliente: MontanteCliente[];
  loading: boolean;
  /** Recibos emitidos sem internet que ainda não subiram para o servidor. */
  pendentesOffline: number;
  /** Desses, quantos o banco recusou (precisam de atenção). */
  pendentesComErro: number;
  /** Envia agora a fila de recibos offline. */
  sincronizarOffline: () => Promise<void>;
}

const RecibosContext = createContext<RecibosContextType>({} as RecibosContextType);

export const useRecibos = () => useContext(RecibosContext);

const defaultEmpresa: EmpresaInfo = {
  name: 'Minha Empresa',
  cnpj: '00.000.000/0001-00',
  address: 'Endereço da empresa',
  phone: '(00) 0000-0000',
  email: 'contato@empresa.com',
  logo: '',
};

export const RecibosProvider = ({ children }: { children: ReactNode }) => {
  const { authenticated } = useAuth();
  const [empresaInfo, setEmpresaInfoState] = useState<EmpresaInfo>(defaultEmpresa);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [solicitantes, setSolicitantes] = useState<Solicitante[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clientServices, setClientServices] = useState<ClientService[]>([]);
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendentesOffline, setPendentesOffline] = useState(() => lerFila().length);
  const [pendentesComErro, setPendentesComErro] = useState(() => lerFila().filter(p => p.erro).length);
  const atualizarContagem = useCallback(() => {
    const fila = lerFila();
    setPendentesOffline(fila.length);
    setPendentesComErro(fila.filter(p => p.erro).length);
  }, []);

  // Põe na tela os cadastros (do servidor ou da cópia guardada).
  const aplicarCadastros = (linhas: CadastrosOffline) => {
    if (linhas.empresa) {
      setEmpresaInfoState({
        name: linhas.empresa.name, cnpj: linhas.empresa.cnpj, address: linhas.empresa.address,
        phone: linhas.empresa.phone, email: linhas.empresa.email, logo: linhas.empresa.logo,
      });
    }

    setClientes(linhas.clientes.map((r) => ({
      id: r.id, name: r.name, cnpj: r.cnpj, phone: r.phone, email: r.email,
    })));

    setSolicitantes(linhas.solicitantes.map((r) => ({
      id: r.id, clienteId: r.cliente_id, name: r.name, phone: r.phone,
    })));

    setObras(linhas.obras.map((r) => ({
      id: r.id, clienteId: r.cliente_id, name: r.name,
      hasDelivery: r.has_delivery ?? false,
      deliveryValue: Number(r.delivery_value ?? 0),
      exemptionValue: Number(r.exemption_value ?? 0),
    })));

    setServicos(linhas.servicos.map((r) => ({
      id: r.id, code: r.code, description: r.description, unitPrice: Number(r.unit_price),
      universal: r.universal,
      descontoQtd: r.desconto_qtd,
      faixas: lerFaixas(r.faixas_desconto),
    })));

    setClientServices(linhas.clientServices.map((r) => ({
      id: r.id, clienteId: r.cliente_id, code: r.code,
      description: r.description, unitPrice: Number(r.unit_price),
    })));
  };

  useEffect(() => {
    if (!authenticated) {
      setLoading(false);
      return;
    }
    const fetchAll = async () => {
      setLoading(true);
      // Sem internet nem tenta o servidor (esperaria a conexão expirar):
      // abre direto com a cópia guardada no aparelho.
      const copiaOffline = semInternet() ? lerCadastros() : null;
      if (copiaOffline) {
        aplicarCadastros(copiaOffline);
        setRecibos(lerFila().map(p => p.recibo));
        setLoading(false);
        return;
      }
      try {
        // Fast queries first — unlock the UI as soon as light data arrives.
        const fastPromise = Promise.all([
          supabase.from('empresa_info').select('*').limit(1).maybeSingle(),
          supabase.from('clientes').select('*').order('created_at'),
          supabase.from('solicitantes').select('*'),
          supabase.from('obras').select('*'),
          supabase.from('servicos').select('*'),
          supabase.from('client_services').select('*'),
        ]);

        // Recibos can be large — fetch in parallel but don't block the UI on it.
        const recibosPromise = supabase.from('recibos').select('*').order('created_at', { ascending: false });

        const [empRes, cliRes, solRes, obrRes, srvRes, csRes] = await fastPromise;

        // Sem internet: usa a última cópia dos cadastros guardada no aparelho.
        const falhou = [cliRes, solRes, obrRes, srvRes, csRes].find(r => r.error)?.error;
        const copia = falhou ? lerCadastros() : null;
        if (falhou && !copia) throw falhou;
        const linhas: CadastrosOffline = copia ?? {
          empresa: empRes.data ?? null,
          clientes: cliRes.data ?? [],
          solicitantes: solRes.data ?? [],
          obras: obrRes.data ?? [],
          servicos: srvRes.data ?? [],
          clientServices: csRes.data ?? [],
        };
        if (!copia) salvarCadastros(linhas);

        aplicarCadastros(linhas);

        // Release the loading state as soon as light data is available.
        setLoading(false);

        // Resolve recibos in background; UI updates when ready.
        recibosPromise.then(recRes => {
          const doServidor: Recibo[] = (recRes.data || []).map((r) => ({
            id: r.id, number: r.number, date: r.date,
            clienteId: r.cliente_id, clienteAvulso: r.cliente_avulso || undefined,
            clienteAvulsoTelefone: r.cliente_avulso_telefone || undefined,
            clienteAvulsoDocumento: r.cliente_avulso_documento || undefined,
            solicitanteId: r.solicitante_id || '',
            obraId: r.obra_id || '',
            obraAvulsa: r.obra_avulsa || undefined,
            lines: (r.lines as unknown as Recibo['lines']) || [],
            total: Number(r.total),
            isPago: r.is_pago, formaPagamento: r.forma_pagamento || undefined,
            valorSinal: r.valor_sinal != null ? Number(r.valor_sinal) : undefined,
          }));
          // Os emitidos sem internet que ainda não subiram aparecem também.
          const noServidor = new Set(doServidor.map(r => r.id));
          const pendentes = lerFila().map(p => p.recibo).filter(r => !noServidor.has(r.id));
          setRecibos([...pendentes, ...doServidor]);
        });

        if (!copia && linhas.clientes.length === 0) {
          migrateFromLocalStorage();
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setLoading(false);
      }
    };
    fetchAll();
  }, [authenticated]);

  const migrateFromLocalStorage = async () => {
    try {
      const lsClientes: Cliente[] = JSON.parse(localStorage.getItem('recibos_clientes') || '[]');
      const lsSolicitantes: Solicitante[] = JSON.parse(localStorage.getItem('recibos_solicitantes') || '[]');
      const lsObras: Obra[] = JSON.parse(localStorage.getItem('recibos_obras') || '[]');
      const lsServicos: Servico[] = JSON.parse(localStorage.getItem('recibos_servicos') || '[]');
      const lsRecibos: Recibo[] = JSON.parse(localStorage.getItem('recibos_recibos') || '[]');
      const lsEmpresa = JSON.parse(localStorage.getItem('recibos_empresa') || 'null');

      if (lsClientes.length === 0 && lsRecibos.length === 0) return;

      const idMap = new Map<string, string>();

      if (lsEmpresa) {
        const { error } = await supabase.from('empresa_info').insert([lsEmpresa]);
        if (!error) setEmpresaInfoState(lsEmpresa);
      }

      if (lsClientes.length > 0) {
        const rows = lsClientes.map((c) => {
          const newId = crypto.randomUUID();
          idMap.set(c.id, newId);
          return { id: newId, name: c.name, cnpj: c.cnpj || '', phone: c.phone || '', email: c.email || '' };
        });
        const { data } = await supabase.from('clientes').insert(rows).select();
        if (data) setClientes(data.map(r => ({ id: r.id, name: r.name, cnpj: r.cnpj, phone: r.phone, email: r.email })));
      }

      if (lsSolicitantes.length > 0) {
        const rows = lsSolicitantes.map((s) => ({
          id: crypto.randomUUID(),
          cliente_id: idMap.get(s.clienteId) || s.clienteId,
          name: s.name, phone: s.phone || '',
        }));
        const { data } = await supabase.from('solicitantes').insert(rows).select();
        if (data) setSolicitantes(data.map(r => ({ id: r.id, clienteId: r.cliente_id, name: r.name, phone: r.phone })));
      }

      if (lsObras.length > 0) {
        const rows = lsObras.map((o) => ({
          id: crypto.randomUUID(),
          cliente_id: idMap.get(o.clienteId) || o.clienteId,
          name: o.name,
        }));
        const { data } = await supabase.from('obras').insert(rows).select();
        if (data) setObras(data.map(r => ({ id: r.id, clienteId: r.cliente_id, name: r.name, hasDelivery: false, deliveryValue: 0, exemptionValue: 0 })));
      }

      if (lsServicos.length > 0) {
        const rows = lsServicos.map((s) => ({
          id: crypto.randomUUID(),
          code: s.code || '', description: s.description || '', unit_price: s.unitPrice || 0,
        }));
        const { data } = await supabase.from('servicos').insert(rows).select();
        if (data) setServicos(data.map(r => ({ id: r.id, code: r.code, description: r.description, unitPrice: Number(r.unit_price), universal: r.universal, descontoQtd: r.desconto_qtd, faixas: lerFaixas(r.faixas_desconto) })));
      }

      if (lsRecibos.length > 0) {
        const rows = lsRecibos.map((r) => ({
          id: crypto.randomUUID(), number: r.number, date: r.date,
          cliente_id: idMap.get(r.clienteId) || r.clienteId,
          solicitante_id: idMap.get(r.solicitanteId) || r.solicitanteId || null,
          obra_id: idMap.get(r.obraId) || r.obraId || null,
          lines: (r.lines || []) as unknown as Json, total: r.total || 0,
        }));
        const { data } = await supabase.from('recibos').insert(rows).select();
        if (data) setRecibos(data.map(r => ({
          id: r.id, number: r.number, date: r.date,
          clienteId: r.cliente_id, solicitanteId: r.solicitante_id || '', obraId: r.obra_id || '',
          lines: (r.lines as unknown as Recibo['lines']) || [], total: Number(r.total),
        })));
      }

      toast.success('Dados locais migrados para a nuvem com sucesso!');
    } catch (err) {
      console.error('Migration error:', err);
    }
  };

  const montantePorCliente = useMemo<MontanteCliente[]>(() => {
    return clientes.map(c => ({
      clienteId: c.id, clienteName: c.name, cnpj: c.cnpj,
      total: recibos.filter(r => r.clienteId === c.id).reduce((sum, r) => sum + r.total, 0),
    }));
  }, [clientes, recibos]);

  const setEmpresaInfo = useCallback(async (info: EmpresaInfo) => {
    setEmpresaInfoState(info);
    const { data: existing } = await supabase.from('empresa_info').select('id').limit(1).maybeSingle();
    if (existing) {
      await supabase.from('empresa_info').update(info).eq('id', existing.id);
    } else {
      await supabase.from('empresa_info').insert([info]);
    }
  }, []);

  const addCliente = useCallback(async (c: Omit<Cliente, 'id'>) => {
    const { data, error } = await supabase.from('clientes').insert([{
      name: c.name, cnpj: c.cnpj, phone: c.phone, email: c.email,
    }]).select().single();
    if (data && !error) {
      setClientes(p => [...p, { id: data.id, name: data.name, cnpj: data.cnpj, phone: data.phone, email: data.email }]);
    }
  }, []);

  const updateCliente = useCallback(async (id: string, c: Partial<Cliente>) => {
    setClientes(p => p.map(x => x.id === id ? { ...x, ...c } : x));
    await supabase.from('clientes').update({
      ...(c.name !== undefined && { name: c.name }),
      ...(c.cnpj !== undefined && { cnpj: c.cnpj }),
      ...(c.phone !== undefined && { phone: c.phone }),
      ...(c.email !== undefined && { email: c.email }),
    }).eq('id', id);
  }, []);

  const deleteCliente = useCallback(async (id: string) => {
    setClientes(p => p.filter(x => x.id !== id));
    await supabase.from('clientes').delete().eq('id', id);
  }, []);

  const addSolicitante = useCallback(async (s: Omit<Solicitante, 'id'>) => {
    const { data, error } = await supabase.from('solicitantes').insert([{
      cliente_id: s.clienteId, name: s.name, phone: s.phone,
    }]).select().single();
    if (data && !error) {
      setSolicitantes(p => [...p, { id: data.id, clienteId: data.cliente_id, name: data.name, phone: data.phone }]);
    }
  }, []);

  const updateSolicitante = useCallback(async (id: string, s: Partial<Solicitante>) => {
    setSolicitantes(p => p.map(x => x.id === id ? { ...x, ...s } : x));
    const dbData: Record<string, unknown> = {};
    if (s.name !== undefined) dbData.name = s.name;
    if (s.phone !== undefined) dbData.phone = s.phone;
    if (s.clienteId !== undefined) dbData.cliente_id = s.clienteId;
    await supabase.from('solicitantes').update(dbData).eq('id', id);
  }, []);

  const deleteSolicitante = useCallback(async (id: string) => {
    setSolicitantes(p => p.filter(x => x.id !== id));
    await supabase.from('solicitantes').delete().eq('id', id);
  }, []);

  const addObra = useCallback(async (o: Omit<Obra, 'id'>) => {
    const { data, error } = await supabase.from('obras').insert([{
      cliente_id: o.clienteId, name: o.name,
      has_delivery: o.hasDelivery ?? false,
      delivery_value: o.deliveryValue ?? 0,
      exemption_value: o.exemptionValue ?? 0,
    }]).select().single();
    if (data && !error) {
      setObras(p => [...p, {
        id: data.id, clienteId: data.cliente_id, name: data.name,
        hasDelivery: data.has_delivery ?? false,
        deliveryValue: Number(data.delivery_value ?? 0),
        exemptionValue: Number(data.exemption_value ?? 0),
      }]);
    }
  }, []);

  const updateObra = useCallback(async (id: string, o: Partial<Obra>) => {
    setObras(p => p.map(x => x.id === id ? { ...x, ...o } : x));
    const dbData: Record<string, unknown> = {};
    if (o.name !== undefined) dbData.name = o.name;
    if (o.clienteId !== undefined) dbData.cliente_id = o.clienteId;
    if (o.hasDelivery !== undefined) dbData.has_delivery = o.hasDelivery;
    if (o.deliveryValue !== undefined) dbData.delivery_value = o.deliveryValue;
    if (o.exemptionValue !== undefined) dbData.exemption_value = o.exemptionValue;
    await supabase.from('obras').update(dbData as TablesUpdate<'obras'>).eq('id', id);
  }, []);

  const deleteObra = useCallback(async (id: string) => {
    setObras(p => p.filter(x => x.id !== id));
    await supabase.from('obras').delete().eq('id', id);
  }, []);

  const addServico = useCallback(async (s: Omit<Servico, 'id'>) => {
    const { data, error } = await supabase.from('servicos').insert([{
      code: s.code, description: s.description, unit_price: s.unitPrice, universal: s.universal ?? false,
      desconto_qtd: s.descontoQtd ?? false, faixas_desconto: (s.faixas ?? []) as unknown as Json,
    }]).select().single();
    if (error || !data) {
      // 23505 = o banco recusou um codigo que ja existe.
      toast.error(error?.code === '23505' ? `O código ${s.code} já está em uso.` : 'Erro ao salvar o serviço.');
      return false;
    }
    setServicos(p => [...p, { id: data.id, code: data.code, description: data.description, unitPrice: Number(data.unit_price), universal: data.universal, descontoQtd: data.desconto_qtd, faixas: lerFaixas(data.faixas_desconto) }]);
    return true;
  }, []);

  const updateServico = useCallback(async (id: string, s: Partial<Servico>) => {
    const dbData: Record<string, unknown> = {};
    if (s.code !== undefined) dbData.code = s.code;
    if (s.description !== undefined) dbData.description = s.description;
    if (s.unitPrice !== undefined) dbData.unit_price = s.unitPrice;
    if (s.universal !== undefined) dbData.universal = s.universal;
    if (s.descontoQtd !== undefined) dbData.desconto_qtd = s.descontoQtd;
    if (s.faixas !== undefined) dbData.faixas_desconto = s.faixas;
    // Grava primeiro e so entao muda a tela: um codigo repetido e recusado
    // pelo banco e a lista continua como estava.
    const { error } = await supabase.from('servicos').update(dbData).eq('id', id);
    if (error) {
      toast.error(error.code === '23505' ? `O código ${s.code} já está em uso.` : 'Erro ao atualizar o serviço.');
      return false;
    }
    setServicos(p => p.map(x => x.id === id ? { ...x, ...s } : x));
    return true;
  }, []);

  const deleteServico = useCallback(async (id: string) => {
    setServicos(p => p.filter(x => x.id !== id));
    await supabase.from('servicos').delete().eq('id', id);
  }, []);

  // --- Client Services CRUD ---
  const addClientService = useCallback(async (s: Omit<ClientService, 'id'>) => {
    const { data, error } = await supabase.from('client_services').insert([{
      cliente_id: s.clienteId, code: s.code, description: s.description, unit_price: s.unitPrice,
    }]).select().single();
    if (error || !data) {
      toast.error(error?.code === '23505' ? `O código ${s.code} já está em uso neste cliente.` : 'Erro ao salvar o serviço.');
      return false;
    }
    const d = data;
    setClientServices(p => [...p, { id: d.id, clienteId: d.cliente_id, code: d.code, description: d.description, unitPrice: Number(d.unit_price) }]);
    return true;
  }, []);

  const updateClientService = useCallback(async (id: string, s: Partial<ClientService>) => {
    const dbData: Record<string, unknown> = {};
    if (s.code !== undefined) dbData.code = s.code;
    if (s.description !== undefined) dbData.description = s.description;
    if (s.unitPrice !== undefined) dbData.unit_price = s.unitPrice;
    if (s.clienteId !== undefined) dbData.cliente_id = s.clienteId;
    const { error } = await supabase.from('client_services').update(dbData as TablesUpdate<'client_services'>).eq('id', id);
    if (error) {
      toast.error(error.code === '23505' ? `O código ${s.code} já está em uso neste cliente.` : 'Erro ao atualizar o serviço.');
      return false;
    }
    setClientServices(p => p.map(x => x.id === id ? { ...x, ...s } : x));
    return true;
  }, []);

  const deleteClientService = useCallback(async (id: string) => {
    setClientServices(p => p.filter(x => x.id !== id));
    await supabase.from('client_services').delete().eq('id', id);
  }, []);

  const registrarAvulso = (r: Pick<Recibo, 'clienteId' | 'clienteAvulso' | 'clienteAvulsoTelefone' | 'clienteAvulsoDocumento'>) => {
    if (!r.clienteAvulso || r.clienteId) return;
    supabase.from('clientes_avulsos').insert([{ name: r.clienteAvulso, phone: r.clienteAvulsoTelefone || '', documento: r.clienteAvulsoDocumento || null }]).then(({ error: e }) => {
      if (e) console.error('Error saving avulso client:', e);
    });
  };

  // Guarda o recibo no aparelho para subir quando a internet voltar.
  const guardarOffline = useCallback(async (r: Omit<Recibo, 'id' | 'number'>, id: string, numero?: string): Promise<Recibo | null> => {
    const number = numero ?? await comTrava('plotjato-numeros', () => tirarNumero());
    if (!number) {
      toast.error('Sem internet e sem números reservados neste aparelho. Emita um orçamento ou aguarde a conexão voltar.');
      return null;
    }
    const salvo: Recibo = { ...r, id, number };
    porNaFila(salvo);
    setRecibos(p => [...p, salvo]);
    atualizarContagem();
    toast.info(`Sem internet: recibo ${number} guardado no aparelho. Ele será enviado quando a conexão voltar.`);
    return salvo;
  }, [atualizarContagem]);

  // Com internet, salva e so devolve depois que o servidor confirmou, ja com
  // o numero definitivo. Sem internet, usa o bloco reservado e entra na fila.
  const addRecibo = useCallback(async (r: Omit<Recibo, 'id' | 'number'>): Promise<Recibo | null> => {
    const id = crypto.randomUUID();
    if (semInternet()) return guardarOffline(r, id);

    // Tenta 2 vezes, para o caso raro de colisao de numero.
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: numData, error: numErr } = await supabase.rpc('next_recibo_number');
      if (numErr || !numData) {
        if (semInternet(numErr)) return guardarOffline(r, id);
        console.error('Error getting next recibo number:', numErr);
        toast.error('Erro ao gerar número do recibo. Verifique sua conexão.');
        return null;
      }
      const number = String(numData);
      const salvo: Recibo = { ...r, id, number };

      const { error } = await supabase.from('recibos').insert([linhaDoRecibo(salvo)]);

      if (!error) {
        setRecibos(p => [...p, salvo]);
        registrarAvulso(r);
        return salvo;
      }

      // A conexao caiu no meio: o numero ja e deste recibo. Vai para a fila
      // com o mesmo id, entao nao duplica nem se o envio tiver chegado.
      if (semInternet(error)) return guardarOffline(r, id, number);

      // 23505 = numero ja usado; tenta de novo com outro.
      if (error.code === '23505' && attempt === 0) continue;

      console.error('Error saving recibo:', error);
      toast.error('Erro ao salvar recibo no servidor. Verifique sua conexão.');
      return null;
    }
    return null;
  }, [guardarOffline]);

  // Sobe a fila de recibos offline e repõe o bloco de números.
  const sincronizando = useRef(false);
  const sincronizarOffline = useCallback(async () => {
    if (!authenticated || sincronizando.current || semInternet()) return;
    sincronizando.current = true;
    let enviados = 0;
    try {
      await comTrava('plotjato-fila', async () => {
        for (const p of lerFila()) {
          // ignoreDuplicates: se este recibo ja chegou antes, nao cria outro.
          const { error } = await supabase.from('recibos')
            .upsert([linhaDoRecibo(p.recibo)], { onConflict: 'id', ignoreDuplicates: true });
          if (error) {
            if (semInternet(error)) break;
            console.error('Recibo offline recusado:', p.recibo.number, error);
            marcarErro(p.recibo.id, error.message);
            continue;
          }
          tirarDaFila(p.recibo.id);
          registrarAvulso(p.recibo);
          enviados++;
        }
      });

      if (numerosDisponiveis().length < REPOR_ABAIXO_DE) {
        await comTrava('plotjato-numeros', async () => {
          if (numerosDisponiveis().length >= REPOR_ABAIXO_DE) return; // outra aba ja repos
          const { data, error } = await supabase.rpc('reservar_numeros_recibo', { qtd: TAMANHO_BLOCO });
          if (!error && Array.isArray(data)) guardarNumeros(data);
          else if (error && !semInternet(error)) console.error('Erro ao reservar números offline:', error);
        });
      }
    } finally {
      sincronizando.current = false;
      atualizarContagem();
    }
    if (enviados > 0) {
      toast.success(enviados === 1 ? '1 recibo emitido sem internet foi enviado.' : `${enviados} recibos emitidos sem internet foram enviados.`);
    }
  }, [authenticated, atualizarContagem]);

  // Envia ao entrar, quando a internet volta e de tempos em tempos.
  useEffect(() => {
    if (!authenticated) return;
    sincronizarOffline();
    const aoVoltar = () => { sincronizarOffline(); };
    window.addEventListener('online', aoVoltar);
    const timer = setInterval(sincronizarOffline, 60 * 1000);
    // Outra aba mexeu na fila: atualiza o contador desta.
    const aoMudar = (e: StorageEvent) => { if (e.key?.startsWith('plotjato:')) atualizarContagem(); };
    window.addEventListener('storage', aoMudar);
    return () => {
      window.removeEventListener('online', aoVoltar);
      window.removeEventListener('storage', aoMudar);
      clearInterval(timer);
    };
  }, [authenticated, sincronizarOffline, atualizarContagem]);

  const deleteRecibo = useCallback(async (id: string) => {
    setRecibos(p => p.filter(x => x.id !== id));
    await supabase.from('recibos').delete().eq('id', id);
  }, []);

  return (
    <RecibosContext.Provider value={{
      empresaInfo, setEmpresaInfo,
      clientes, addCliente, updateCliente, deleteCliente,
      solicitantes, addSolicitante, updateSolicitante, deleteSolicitante,
      obras, addObra, updateObra, deleteObra,
      servicos, addServico, updateServico, deleteServico,
      clientServices, addClientService, updateClientService, deleteClientService,
      recibos, addRecibo, deleteRecibo,
      montantePorCliente,
      loading,
      pendentesOffline, pendentesComErro, sincronizarOffline,
    }}>
      {children}
    </RecibosContext.Provider>
  );
};

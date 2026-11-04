import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Cliente, Solicitante, Obra, Servico, Recibo, EmpresaInfo, ClientService } from '@/types/recibos';
import { toast } from 'sonner';

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
  addServico: (s: Omit<Servico, 'id'>) => void;
  updateServico: (id: string, s: Partial<Servico>) => void;
  deleteServico: (id: string) => void;
  clientServices: ClientService[];
  addClientService: (s: Omit<ClientService, 'id'>) => void;
  updateClientService: (id: string, s: Partial<ClientService>) => void;
  deleteClientService: (id: string) => void;
  recibos: Recibo[];
  addRecibo: (r: Omit<Recibo, 'id' | 'number'>) => Recibo;
  deleteRecibo: (id: string) => void;
  montantePorCliente: MontanteCliente[];
  loading: boolean;
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

  useEffect(() => {
    if (!authenticated) {
      setLoading(false);
      return;
    }
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Fast queries first — unlock the UI as soon as light data arrives.
        const fastPromise = Promise.all([
          supabase.from('empresa_info').select('*').limit(1).maybeSingle(),
          supabase.from('clientes').select('*').order('created_at'),
          supabase.from('solicitantes').select('*'),
          supabase.from('obras').select('*'),
          supabase.from('servicos').select('*'),
          supabase.from('client_services' as any).select('*'),
        ]);

        // Recibos can be large — fetch in parallel but don't block the UI on it.
        const recibosPromise = supabase.from('recibos').select('*').order('created_at', { ascending: false });

        const [empRes, cliRes, solRes, obrRes, srvRes, csRes] = await fastPromise;

        if (empRes.data) {
          setEmpresaInfoState({
            name: empRes.data.name, cnpj: empRes.data.cnpj, address: empRes.data.address,
            phone: empRes.data.phone, email: empRes.data.email, logo: empRes.data.logo,
          });
        }

        setClientes((cliRes.data || []).map((r: any) => ({
          id: r.id, name: r.name, cnpj: r.cnpj, phone: r.phone, email: r.email,
        })));

        setSolicitantes((solRes.data || []).map((r: any) => ({
          id: r.id, clienteId: r.cliente_id, name: r.name, phone: r.phone,
        })));

        setObras((obrRes.data || []).map((r: any) => ({
          id: r.id, clienteId: r.cliente_id, name: r.name,
          hasDelivery: r.has_delivery ?? false,
          deliveryValue: Number(r.delivery_value ?? 0),
          exemptionValue: Number(r.exemption_value ?? 0),
        })));

        setServicos((srvRes.data || []).map((r: any) => ({
          id: r.id, code: r.code, description: r.description, unitPrice: Number(r.unit_price),
        })));

        setClientServices((csRes.data || []).map((r: any) => ({
          id: r.id, clienteId: r.cliente_id, code: r.code,
          description: r.description, unitPrice: Number(r.unit_price),
        })));

        // Release the loading state as soon as light data is available.
        setLoading(false);

        // Resolve recibos in background; UI updates when ready.
        recibosPromise.then(recRes => {
          setRecibos((recRes.data || []).map((r: any) => ({
            id: r.id, number: r.number, date: r.date,
            clienteId: r.cliente_id, clienteAvulso: r.cliente_avulso || undefined,
            solicitanteId: r.solicitante_id || '',
            obraId: r.obra_id || '',
            lines: (r.lines as unknown as Recibo['lines']) || [],
            total: Number(r.total),
          })));
        });

        if ((cliRes.data || []).length === 0) {
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
      const lsClientes = JSON.parse(localStorage.getItem('recibos_clientes') || '[]');
      const lsSolicitantes = JSON.parse(localStorage.getItem('recibos_solicitantes') || '[]');
      const lsObras = JSON.parse(localStorage.getItem('recibos_obras') || '[]');
      const lsServicos = JSON.parse(localStorage.getItem('recibos_servicos') || '[]');
      const lsRecibos = JSON.parse(localStorage.getItem('recibos_recibos') || '[]');
      const lsEmpresa = JSON.parse(localStorage.getItem('recibos_empresa') || 'null');

      if (lsClientes.length === 0 && lsRecibos.length === 0) return;

      const idMap = new Map<string, string>();

      if (lsEmpresa) {
        const { error } = await supabase.from('empresa_info').insert([lsEmpresa]);
        if (!error) setEmpresaInfoState(lsEmpresa);
      }

      if (lsClientes.length > 0) {
        const rows = lsClientes.map((c: any) => {
          const newId = crypto.randomUUID();
          idMap.set(c.id, newId);
          return { id: newId, name: c.name, cnpj: c.cnpj || '', phone: c.phone || '', email: c.email || '' };
        });
        const { data } = await supabase.from('clientes').insert(rows).select();
        if (data) setClientes(data.map(r => ({ id: r.id, name: r.name, cnpj: r.cnpj, phone: r.phone, email: r.email })));
      }

      if (lsSolicitantes.length > 0) {
        const rows = lsSolicitantes.map((s: any) => ({
          id: crypto.randomUUID(),
          cliente_id: idMap.get(s.clienteId) || s.clienteId,
          name: s.name, phone: s.phone || '',
        }));
        const { data } = await supabase.from('solicitantes').insert(rows).select();
        if (data) setSolicitantes(data.map(r => ({ id: r.id, clienteId: r.cliente_id, name: r.name, phone: r.phone })));
      }

      if (lsObras.length > 0) {
        const rows = lsObras.map((o: any) => ({
          id: crypto.randomUUID(),
          cliente_id: idMap.get(o.clienteId) || o.clienteId,
          name: o.name,
        }));
        const { data } = await supabase.from('obras').insert(rows).select();
        if (data) setObras(data.map(r => ({ id: r.id, clienteId: r.cliente_id, name: r.name, hasDelivery: false, deliveryValue: 0, exemptionValue: 0 })));
      }

      if (lsServicos.length > 0) {
        const rows = lsServicos.map((s: any) => ({
          id: crypto.randomUUID(),
          code: s.code || '', description: s.description || '', unit_price: s.unitPrice || 0,
        }));
        const { data } = await supabase.from('servicos').insert(rows).select();
        if (data) setServicos(data.map(r => ({ id: r.id, code: r.code, description: r.description, unitPrice: Number(r.unit_price) })));
      }

      if (lsRecibos.length > 0) {
        const rows = lsRecibos.map((r: any) => ({
          id: crypto.randomUUID(), number: r.number, date: r.date,
          cliente_id: idMap.get(r.clienteId) || r.clienteId,
          solicitante_id: idMap.get(r.solicitanteId) || r.solicitanteId || null,
          obra_id: idMap.get(r.obraId) || r.obraId || null,
          lines: r.lines || [], total: r.total || 0,
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
    } as any]).select().single();
    if (data && !error) {
      setObras(p => [...p, {
        id: data.id, clienteId: data.cliente_id, name: data.name,
        hasDelivery: (data as any).has_delivery ?? false,
        deliveryValue: Number((data as any).delivery_value ?? 0),
        exemptionValue: Number((data as any).exemption_value ?? 0),
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
    await supabase.from('obras').update(dbData as any).eq('id', id);
  }, []);

  const deleteObra = useCallback(async (id: string) => {
    setObras(p => p.filter(x => x.id !== id));
    await supabase.from('obras').delete().eq('id', id);
  }, []);

  const addServico = useCallback(async (s: Omit<Servico, 'id'>) => {
    const { data, error } = await supabase.from('servicos').insert([{
      code: s.code, description: s.description, unit_price: s.unitPrice,
    }]).select().single();
    if (data && !error) {
      setServicos(p => [...p, { id: data.id, code: data.code, description: data.description, unitPrice: Number(data.unit_price) }]);
    }
  }, []);

  const updateServico = useCallback(async (id: string, s: Partial<Servico>) => {
    setServicos(p => p.map(x => x.id === id ? { ...x, ...s } : x));
    const dbData: Record<string, unknown> = {};
    if (s.code !== undefined) dbData.code = s.code;
    if (s.description !== undefined) dbData.description = s.description;
    if (s.unitPrice !== undefined) dbData.unit_price = s.unitPrice;
    await supabase.from('servicos').update(dbData).eq('id', id);
  }, []);

  const deleteServico = useCallback(async (id: string) => {
    setServicos(p => p.filter(x => x.id !== id));
    await supabase.from('servicos').delete().eq('id', id);
  }, []);

  // --- Client Services CRUD ---
  const addClientService = useCallback(async (s: Omit<ClientService, 'id'>) => {
    const { data, error } = await supabase.from('client_services' as any).insert([{
      cliente_id: s.clienteId, code: s.code, description: s.description, unit_price: s.unitPrice,
    }]).select().single();
    if (data && !error) {
      const d = data as any;
      setClientServices(p => [...p, { id: d.id, clienteId: d.cliente_id, code: d.code, description: d.description, unitPrice: Number(d.unit_price) }]);
    }
  }, []);

  const updateClientService = useCallback(async (id: string, s: Partial<ClientService>) => {
    setClientServices(p => p.map(x => x.id === id ? { ...x, ...s } : x));
    const dbData: Record<string, unknown> = {};
    if (s.code !== undefined) dbData.code = s.code;
    if (s.description !== undefined) dbData.description = s.description;
    if (s.unitPrice !== undefined) dbData.unit_price = s.unitPrice;
    if (s.clienteId !== undefined) dbData.cliente_id = s.clienteId;
    await supabase.from('client_services' as any).update(dbData).eq('id', id);
  }, []);

  const deleteClientService = useCallback(async (id: string) => {
    setClientServices(p => p.filter(x => x.id !== id));
    await supabase.from('client_services' as any).delete().eq('id', id);
  }, []);

  const addRecibo = useCallback((r: Omit<Recibo, 'id' | 'number'>): Recibo => {
    // Provisional local number (replaced by server-assigned number once persisted)
    const maxNum = recibos.reduce((max, rc) => {
      const n = parseInt(rc.number, 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const provisionalNumber = String(maxNum + 1).padStart(4, '0');
    const newRecibo: Recibo = { ...r, id: crypto.randomUUID(), number: provisionalNumber };
    setRecibos(p => [...p, newRecibo]);

    // If avulso client, save to clientes_avulsos
    if (r.clienteAvulso && !r.clienteId) {
      supabase.from('clientes_avulsos' as any).insert([{ name: r.clienteAvulso }]).then(({ error }) => {
        if (error) console.error('Error saving avulso client:', error);
      });
    }

    const persist = async () => {
      // Try up to 2 times in case of a rare unique-number collision
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data: numData, error: numErr } = await supabase.rpc('next_recibo_number' as any);
        if (numErr || !numData) {
          console.error('Error getting next recibo number:', numErr);
          toast.error('Erro ao gerar número do recibo. Verifique sua conexão.');
          setRecibos(p => p.filter(x => x.id !== newRecibo.id));
          return;
        }
        const serverNumber = String(numData);

        const { error } = await supabase.from('recibos').insert([{
          id: newRecibo.id, number: serverNumber, date: newRecibo.date,
          cliente_id: newRecibo.clienteId || null,
          cliente_avulso: newRecibo.clienteAvulso || null,
          solicitante_id: newRecibo.solicitanteId || null,
          obra_id: newRecibo.obraId || null,
          lines: JSON.parse(JSON.stringify(newRecibo.lines)),
          total: newRecibo.total,
        } as any]);

        if (!error) {
          // Replace provisional number with the server-assigned one
          newRecibo.number = serverNumber;
          setRecibos(p => p.map(x => x.id === newRecibo.id ? { ...x, number: serverNumber } : x));
          return;
        }

        // 23505 = unique_violation; retry once with a fresh number
        if ((error as any).code === '23505' && attempt === 0) continue;

        console.error('Error saving recibo:', error);
        toast.error('Erro ao salvar recibo no servidor. Verifique sua conexão.');
        setRecibos(p => p.filter(x => x.id !== newRecibo.id));
        return;
      }
    };
    persist();

    return newRecibo;
  }, [recibos]);

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
    }}>
      {children}
    </RecibosContext.Provider>
  );
};

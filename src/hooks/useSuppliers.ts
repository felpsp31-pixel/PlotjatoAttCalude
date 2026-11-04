import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Entity } from '@/types/finance';
import { toast } from 'sonner';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase.from('suppliers').select('*').order('created_at');
      if (error) {
        console.error('Error fetching suppliers:', error);
        setLoading(false);
        return;
      }

      const dbSuppliers: Entity[] = (data || []).map(r => ({
        id: r.id,
        name: r.name,
        type: 'supplier' as const,
        document: r.document || undefined,
        phone: r.phone || undefined,
        email: r.email || undefined,
        retainsISS: r.retains_iss,
      }));

      // One-time migration from localStorage
      if (dbSuppliers.length === 0) {
        try {
          const ls = JSON.parse(localStorage.getItem('financeiro_suppliers') || '[]');
          if (ls.length > 0) {
            const rows = ls.map((s: any) => ({
              name: s.name,
              document: s.document || '',
              phone: s.phone || '',
              email: s.email || '',
              retains_iss: s.retainsISS || false,
            }));
            const { data: inserted } = await supabase.from('suppliers').insert(rows).select();
            if (inserted) {
              const migrated = inserted.map(r => ({
                id: r.id, name: r.name, type: 'supplier' as const,
                document: r.document || undefined, phone: r.phone || undefined,
                email: r.email || undefined, retainsISS: r.retains_iss,
              }));
              setSuppliers(migrated);
              toast.success('Fornecedores migrados para a nuvem!');
              setLoading(false);
              return;
            }
          }
        } catch { /* ignore */ }
      }

      setSuppliers(dbSuppliers);
      setLoading(false);
    };
    fetch();
  }, []);

  const addSupplier = useCallback(async (s: Omit<Entity, 'id'>) => {
    const { data, error } = await supabase.from('suppliers').insert([{
      name: s.name,
      document: s.document || '',
      phone: s.phone || '',
      email: s.email || '',
      retains_iss: s.retainsISS,
    }]).select().single();
    if (data && !error) {
      const newEntity: Entity = {
        id: data.id, name: data.name, type: 'supplier',
        document: data.document || undefined, phone: data.phone || undefined,
        email: data.email || undefined, retainsISS: data.retains_iss,
      };
      setSuppliers(p => [...p, newEntity]);
      return newEntity;
    }
    return null;
  }, []);

  const updateSupplier = useCallback(async (id: string, data: Partial<Entity>) => {
    setSuppliers(p => p.map(s => s.id === id ? { ...s, ...data } : s));
    const dbData: Record<string, unknown> = {};
    if (data.name !== undefined) dbData.name = data.name;
    if (data.document !== undefined) dbData.document = data.document;
    if (data.phone !== undefined) dbData.phone = data.phone;
    if (data.email !== undefined) dbData.email = data.email;
    if (data.retainsISS !== undefined) dbData.retains_iss = data.retainsISS;
    await supabase.from('suppliers').update(dbData).eq('id', id);
  }, []);

  const deleteSupplier = useCallback(async (id: string) => {
    setSuppliers(p => p.filter(s => s.id !== id));
    await supabase.from('suppliers').delete().eq('id', id);
  }, []);

  return { suppliers, loading, addSupplier, updateSupplier, deleteSupplier };
}

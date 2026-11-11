import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface ComboboxProps {
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Aceita um nome digitado que nao esta na lista (ex.: obra avulsa). */
  textoLivre?: string;
  onTextoLivre?: (valor: string) => void;
}

const Combobox = ({ options, value, onValueChange, placeholder = 'Selecione...', searchPlaceholder = 'Buscar...', emptyText = 'Nenhum resultado.', disabled, textoLivre, onTextoLivre }: ComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const selected = options.find(o => o.value === value);
  const aceitaLivre = !!onTextoLivre;
  const podeUsarDigitado = useMemo(() => {
    const t = busca.trim();
    return aceitaLivre && t.length > 0 && !options.some(o => o.label.toLowerCase() === t.toLowerCase());
  }, [aceitaLivre, busca, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-7 text-xs px-2" disabled={disabled}>
          <span className="truncate">{selected ? selected.label : (textoLivre || placeholder)}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={busca} onValueChange={setBusca} />
          <CommandList>
            <CommandEmpty>{aceitaLivre ? 'Digite para usar um nome avulso.' : emptyText}</CommandEmpty>
            {podeUsarDigitado && (
              <CommandGroup>
                <CommandItem value={`__livre__${busca}`} onSelect={() => { onTextoLivre?.(busca.trim()); setBusca(''); setOpen(false); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Usar "{busca.trim()}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {options.map(o => (
                <CommandItem key={o.value} value={o.label} onSelect={() => { onValueChange(o.value); setBusca(''); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default Combobox;

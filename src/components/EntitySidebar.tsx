import { useState } from 'react';
import { Settings, AlertCircle, BarChart3, Clock, Trash2 } from 'lucide-react';
import EntityAvatar from './EntityAvatar';
import SettingsModal from './SettingsModal';
import type { Entity, Invoice } from '@/types/finance';
import { hojeBR, somarDias } from '@/lib/dataLocal';

export type SidebarTab = 'clients' | 'suppliers' | 'casual';

interface EntitySidebarProps {
  entities: Entity[];
  invoices: Invoice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenResumo: () => void;
  activeTab?: SidebarTab;
  onTabChange?: (tab: SidebarTab) => void;
  /** Só na aba Avulsos: mostra a lixeira ao lado do nome. */
  onDeleteCasual?: (entity: Entity) => void;
}

const EntitySidebar = ({ entities, invoices, selectedId, onSelect, onOpenResumo, activeTab, onTabChange, onDeleteCasual }: EntitySidebarProps) => {
  const [internalTab, setInternalTab] = useState<SidebarTab>('clients');
  const tab = activeTab ?? internalTab;
  const setTab = onTabChange ?? setInternalTab;
  const [settingsOpen, setSettingsOpen] = useState(false);

  const filtered = entities.filter((e) =>
    tab === 'clients' ? e.type === 'client' : tab === 'suppliers' ? e.type === 'supplier' : e.type === 'casual'
  );

  const hasOverdue = (entityId: string) =>
    invoices.some((inv) => inv.entityId === entityId && inv.status === 'overdue');

  const hasDueTomorrow = (entityId: string) => {
    const tomorrowStr = somarDias(hojeBR(), 1);
    return invoices.some(
      (inv) => inv.entityId === entityId && inv.dueDate === tomorrowStr && inv.status !== 'paid'
    );
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Segmented Control */}
      <div className="p-4 pb-2">
        <div className="flex bg-secondary rounded-lg p-1 gap-1">
          <button
            onClick={() => setTab('clients')}
            className={`flex-1 text-xs font-medium py-2 rounded-md transition-all duration-150 ${
              tab === 'clients'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Clientes
          </button>
          <button
            onClick={() => setTab('suppliers')}
            className={`flex-1 text-xs font-medium py-2 rounded-md transition-all duration-150 ${
              tab === 'suppliers'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Fornecedores
          </button>
          <button
            onClick={() => setTab('casual')}
            className={`flex-1 text-xs font-medium py-2 rounded-md transition-all duration-150 ${
              tab === 'casual'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Avulsos
          </button>
        </div>
      </div>

      {/* Entity List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filtered.map((entity) => {
          const isOverdue = hasOverdue(entity.id);
          const isDueTomorrow = entity.type === 'supplier' && hasDueTomorrow(entity.id);
          const isSelected = selectedId === entity.id;
          return (
            // Linha e div, nao button: a lixeira e um botao e HTML nao
            // permite botao dentro de botao.
            <div
              key={entity.id}
              className={`group w-full flex items-center gap-3 pl-3 pr-2 py-2.5 rounded-lg transition-all duration-150 mb-0.5 ${
                isSelected
                  ? 'bg-secondary text-foreground'
                  : 'text-foreground hover:bg-secondary/60'
              }`}
            >
              <button
                onClick={() => onSelect(entity.id)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <EntityAvatar name={entity.name} size="sm" />
                <span className="text-sm font-medium truncate">{entity.name}</span>
              </button>
              {isDueTomorrow && !isOverdue && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-warning bg-warning/15 rounded-full px-1.5 py-0.5 shrink-0">
                  <Clock className="h-3 w-3" />
                  Amanhã
                </span>
              )}
              {isOverdue && (
                <AlertCircle className="h-4 w-4 text-destructive animate-pulse-alert shrink-0" />
              )}
              {entity.type === 'casual' && onDeleteCasual && (
                <button
                  onClick={() => onDeleteCasual(entity)}
                  aria-label={`Apagar ${entity.name}`}
                  title="Apagar cliente avulso"
                  // Visivel sempre no toque, onde nao existe hover; no
                  // desktop so aparece quando o ponteiro passa pela linha.
                  className="shrink-0 p-1.5 rounded-md text-muted-foreground transition
                    opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100
                    hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1">
        <button
          onClick={onOpenResumo}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 px-2 py-1.5 w-full"
        >
          <BarChart3 className="h-4 w-4" />
          Resumo
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 px-2 py-1.5 w-full"
        >
          <Settings className="h-4 w-4" />
          Configurações
        </button>
      </div>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};

export default EntitySidebar;

import { useState } from 'react';
import { Phone, Mail, FileText, Pencil, Trash2 } from 'lucide-react';
import EntityAvatar from './EntityAvatar';
import SupplierFormDialog from './SupplierFormDialog';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Entity } from '@/types/finance';

interface EntityHeaderProps {
  entity: Entity;
  onUpdate?: (data: Partial<Entity>) => void;
  onDelete?: () => void;
}

const EntityHeader = ({ entity, onUpdate, onDelete }: EntityHeaderProps) => {
  const isSupplier = entity.type === 'supplier';

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-2 sm:p-3 mb-2 sm:mb-4">
      <div className="flex items-start gap-4">
        <EntityAvatar name={entity.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-lg font-semibold text-foreground truncate">{entity.name}</h2>
            {entity.retainsISS && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-badge-iss text-badge-iss-foreground shrink-0">
                Retém ISS
              </span>
            )}
            {isSupplier && onUpdate && (
              <SupplierFormDialog
                defaultValues={entity}
                onSave={(data) => onUpdate(data)}
                trigger={
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Editar fornecedor">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                }
              />
            )}
            {isSupplier && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" title="Excluir fornecedor">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir fornecedor</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover este fornecedor? Os lançamentos vinculados serão mantidos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {entity.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {entity.phone}
              </span>
            )}
            {entity.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {entity.email}
              </span>
            )}
            {entity.document && (
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {entity.document}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityHeader;

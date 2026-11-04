import { Calendar, CheckCircle2, Trash2, Eye } from "lucide-react";
import { motion } from "framer-motion";
import type { Invoice, Attachment } from "@/types/finance";
import PdfUploadButton from "./PdfUploadButton";
import PdfAttachButton from "./PdfAttachButton";
import FilePreviewModal from "./FilePreviewModal";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface InvoiceCardProps {
  invoice: Invoice;
  onMarkPaid?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: Partial<Invoice>) => void;
}

const statusStyles: Record<string, string> = {
  open: "border-l-primary",
  paid: "border-l-success",
  overdue: "border-l-destructive",
};

const InvoiceCard = ({ invoice, onMarkPaid, onDelete, onUpdate }: InvoiceCardProps) => {
  const [previewOpen, setPreviewOpen] = useState(false);

  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(invoice.value);

  const dueFormatted = new Date(invoice.dueDate + "T00:00:00").toLocaleDateString("pt-BR");

  const hasAttachments = invoice.attachments.length > 0;

  const handleRemoveAttachment = (index: number) => {
    if (!onUpdate) return;
    const updated = [...invoice.attachments];
    updated.splice(index, 1);
    onUpdate(invoice.id, { attachments: updated });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`bg-card rounded-xl shadow-sm hover:shadow-md border border-border border-l-4 ${statusStyles[invoice.status]} p-4 transition-shadow duration-150`}
    >
      {/* Linha 1: Valor + Data de vencimento */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-base sm:text-lg font-semibold text-foreground truncate">{formatted}</p>
        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 ml-2">
          <Calendar className="h-3.5 w-3.5" />
          {dueFormatted}
        </span>
      </div>

      {/* Linha 2: Descrição */}
      <p className="text-sm text-muted-foreground mb-2 truncate">{invoice.description}</p>

      {/* Linha 3: Botões de ação */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          {hasAttachments && (
            <button
              onClick={() => setPreviewOpen(true)}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{invoice.attachments.length}</span>
            </button>
          )}
          {onUpdate && (
            <PdfAttachButton
              invoiceId={invoice.id}
              attachments={invoice.attachments}
              onAttached={(url, name) =>
                onUpdate(invoice.id, {
                  attachments: [...invoice.attachments, { url, name, date: new Date().toISOString() }],
                })
              }
            />
          )}
          {onUpdate && (
            <PdfUploadButton
              variant="icon"
              onExtracted={(data) => {
                const updates: Partial<Invoice> = {};
                if (data.value != null) updates.value = data.value;
                if (data.dueDate) updates.dueDate = data.dueDate;
                if (data.description) updates.description = data.description;
                onUpdate(invoice.id, updates);
              }}
            />
          )}
          {(invoice.status === "open" || invoice.status === "overdue") && onMarkPaid && (
            <button
              onClick={() => onMarkPaid(invoice.id)}
              className="flex items-center gap-1 text-xs font-medium text-success hover:text-success/80 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Pagar
            </button>
          )}

          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="flex items-center gap-1 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar lançamento</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja apagar "{invoice.description}"? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(invoice.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Apagar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {hasAttachments && (
        <FilePreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          attachments={invoice.attachments}
          onRemove={onUpdate ? handleRemoveAttachment : undefined}
        />
      )}
    </motion.div>
  );
};

export default InvoiceCard;

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, X, Paperclip } from 'lucide-react';
import type { Attachment } from '@/types/finance';
import { useEffect, useState } from 'react';
import { urlAssinada } from '@/lib/arquivoPrivado';

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachments: Attachment[];
  onRemove?: (index: number) => void;
}

const FilePreviewModal = ({ open, onOpenChange, attachments, onRemove }: FilePreviewModalProps) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const safeIdx = Math.min(selectedIdx, Math.max(0, attachments.length - 1));
  const current = attachments[safeIdx];

  // Buckets privados: troca cada link guardado por um link assinado temporario.
  const [assinadas, setAssinadas] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    Promise.all(attachments.map(async (a) => [a.url, await urlAssinada(a.url)] as const)).then((pares) => {
      if (vivo) setAssinadas(Object.fromEntries(pares));
    });
    return () => { vivo = false; };
  }, [open, attachments]);
  const link = (url: string) => assinadas[url] ?? '';

  if (!current) return null;

  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(current.name);
  const isPdf = /\.pdf$/i.test(current.name) || current.url.includes('.pdf');
  const dateFormatted = new Date(current.date).toLocaleDateString('pt-BR');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div className="flex-1 min-w-0">
            <DialogTitle className="truncate pr-4">{current.name}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Anexado em {dateFormatted}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <a href={link(current.url)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={link(current.url)} download={current.name}>
                <Download className="h-4 w-4 mr-1" />
                Baixar
              </a>
            </Button>
          </div>
        </DialogHeader>

        {attachments.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto py-2 border-b border-border">
            {attachments.map((att, idx) => {
              const isImg = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(att.name);
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={`relative shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden transition-all ${
                    idx === safeIdx ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                  }`}
                >
                  {isImg ? (
                    <img src={link(att.url)} alt={att.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                      <Paperclip className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  {onRemove && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
                      className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl-md p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-secondary/30">
          {isPdf ? (
            <iframe src={link(current.url)} className="w-full h-[70vh] rounded-lg" title={current.name} />
          ) : isImage ? (
            <div className="flex items-center justify-center p-4">
              <img src={link(current.url)} alt={current.name} className="max-w-full max-h-[65vh] object-contain rounded" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Pré-visualização não disponível para este tipo de arquivo.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreviewModal;

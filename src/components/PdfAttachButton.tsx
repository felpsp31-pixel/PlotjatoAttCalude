import { useState, useRef } from 'react';
import { Paperclip, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Attachment } from '@/types/finance';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PdfAttachButtonProps {
  invoiceId: string;
  attachments: Attachment[];
  onAttached: (url: string, name: string) => void;
  variant?: 'icon' | 'full';
  className?: string;
}

const BUCKET = 'invoice-attachments';
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const PdfAttachButton = ({
  invoiceId,
  attachments,
  onAttached,
  variant = 'icon',
  className = '',
}: PdfAttachButtonProps) => {
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Apenas PDF e imagens (JPG, PNG, GIF, WebP) são aceitos.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setLoading(true);
    try {
      const filePath = `${invoiceId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(filePath);

      onAttached(urlData.publicUrl, file.name);
      toast.success(`Anexo "${file.name}" adicionado.`);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao anexar arquivo.');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(handleFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files) {
      Array.from(files).forEach(handleFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  if (variant === 'full') {
    return (
      <div className={className}>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
          className="hidden"
          onChange={handleChange}
          multiple
        />
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Anexando...
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Arraste ou clique para anexar
              </span>
              <span className="text-xs text-muted-foreground/60">
                PDF, JPG, PNG (máx. 10MB) — múltiplos arquivos
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Icon variant
  return (
    <TooltipProvider>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
        className="hidden"
        onChange={handleChange}
        multiple
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className={`flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 ${className}`}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Anexar arquivo</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default PdfAttachButton;

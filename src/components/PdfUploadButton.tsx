import { useState, useRef } from 'react';
import { Upload, Loader2, FileUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export interface ExtractedData {
  value: number | null;
  dueDate: string | null;
  description: string | null;
}

interface PdfUploadButtonProps {
  onExtracted: (data: ExtractedData) => void;
  variant?: 'icon' | 'full';
  className?: string;
}

const PdfUploadButton = ({ onExtracted, variant = 'icon', className = '' }: PdfUploadButtonProps) => {
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são aceitos.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('extract-pdf-data', {
        body: formData,
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      onExtracted({
        value: data.value ?? null,
        dueDate: data.dueDate ?? null,
        description: data.description ?? null,
      });

      const extracted: string[] = [];
      if (data.value != null) extracted.push(`Valor: R$ ${data.value.toFixed(2)}`);
      if (data.dueDate) extracted.push(`Vencimento: ${new Date(data.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}`);
      if (data.description) extracted.push(`Desc: ${data.description}`);

      toast.success(`Dados extraídos: ${extracted.join(' | ') || 'Nenhum dado encontrado'}`);
    } catch (err: unknown) {
      console.error('PDF extraction error:', err);
      toast.error('Erro ao extrair dados do PDF. Tente inserir manualmente.');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleChange}
      />
      {variant === 'icon' ? (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className={`flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50 ${className}`}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {variant === 'icon' && !loading && 'PDF'}
        </button>
      ) : (
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className={className}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <FileUp className="h-4 w-4 mr-2" />
          )}
          {loading ? 'Extraindo...' : 'Importar do PDF'}
        </Button>
      )}
    </>
  );
};

export default PdfUploadButton;

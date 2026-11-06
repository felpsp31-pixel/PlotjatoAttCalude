import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SettingsModal = ({ open, onOpenChange }: SettingsModalProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!currentPassword) {
      toast.error('Digite a senha atual.');
      return;
    }
    if (newPassword.trim().length < 8) {
      toast.error('A nova senha precisa ter ao menos 8 caracteres.');
      return;
    }
    setLoading(true);
    // Use edge function to hash and store password server-side
    const { data, error } = await supabase.functions.invoke('validate-password', {
      body: { password: newPassword, currentPassword, type: 'access_password', action: 'update' },
    });
    setLoading(false);

    if (error || !data?.success) {
      let msg = 'Erro ao atualizar senha.';
      try {
        const corpo = await (error as { context?: Response })?.context?.json();
        if (corpo?.error) msg = corpo.error;
      } catch { /* ignore */ }
      toast.error(data?.error ?? msg);
      return;
    }
    toast.success('Senha de acesso atualizada com sucesso!');
    setNewPassword('');
    setCurrentPassword('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="new-pw">Senha de acesso geral</Label>
            <Input
              id="current-pw"
              type="password"
              placeholder="Senha atual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              id="new-pw"
              type="password"
              placeholder="Nova senha"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Esta senha será usada por todos que acessam o sistema.
            </p>
          </div>
          <Button onClick={handleSave} className="w-full" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;

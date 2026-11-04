import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { FileText, Users, Wrench, BarChart3, FileBarChart, Settings, ArrowLeft, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRecibos } from '@/contexts/RecibosContext';

import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';

const links = [
  { to: '/recibos', label: 'Recibos', icon: FileText, end: true },
  { to: '/recibos/clientes', label: 'Clientes', icon: Users, end: false },
  { to: '/recibos/servicos', label: 'Serviços', icon: Wrench, end: false },
  { to: '/recibos/dashboard', label: 'Dashboard', icon: BarChart3, end: false },
  { to: '/recibos/relatorios', label: 'Relatórios', icon: FileBarChart, end: false },
];

const RecibosLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { empresaInfo, setEmpresaInfo } = useRecibos();
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [form, setForm] = useState(empresaInfo);

  const handleSave = () => {
    setEmpresaInfo(form);
    setSettingsOpen(false);
    toast.success('Configurações salvas');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(p => ({ ...p, logo: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const expanded = isMobile ? true : hovered;

  const sidebarContent = (
    <>
      <div className="px-3 py-4">
        <button onClick={() => { navigate('/'); setMobileDrawerOpen(false); }} className="flex items-center gap-3 px-1 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md min-h-[44px]">
          <ArrowLeft className="h-5 w-5 shrink-0" />
          {expanded && <span className="whitespace-nowrap">Início</span>}
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {links.map(l => {
          const link = (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setMobileDrawerOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-1 py-2 rounded-md text-sm transition-colors whitespace-nowrap min-h-[44px]',
                isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <l.icon className="h-5 w-5 shrink-0" />
              {expanded && l.label}
            </NavLink>
          );
          return expanded ? link : (
            <Tooltip key={l.to}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{l.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
      <div className="border-t border-border px-3 py-2 space-y-1">
        <ThemeToggle expanded={expanded} />
        {expanded ? (
          <Button variant="ghost" className="w-full justify-start gap-3 px-1 min-h-[44px]" onClick={() => { setForm(empresaInfo); setSettingsOpen(true); setMobileDrawerOpen(false); }}>
            <Settings className="h-5 w-5 shrink-0" /> Configurações
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" className="w-full justify-start px-1 min-h-[44px]" onClick={() => { setForm(empresaInfo); setSettingsOpen(true); }}>
                <Settings className="h-5 w-5 shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Configurações</TooltipContent>
          </Tooltip>
        )}
      </div>
    </>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className="h-screen flex overflow-hidden bg-background">
        {/* Mobile hamburger */}
        {isMobile && (
          <div className="fixed top-0 left-0 right-0 z-40 flex items-center h-12 px-3 bg-background border-b border-border md:hidden">
            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={() => setMobileDrawerOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <span className="ml-2 text-sm font-medium text-foreground truncate">
              {links.find(l => l.end ? location.pathname === l.to : location.pathname.startsWith(l.to) && !l.end)?.label ?? 'Recibos'}
            </span>
          </div>
        )}

        {/* Mobile drawer */}
        {isMobile && (
          <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              {sidebarContent}
            </SheetContent>
          </Sheet>
        )}

        {/* Desktop sidebar */}
        {!isMobile && (
          <aside
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={cn(
              'shrink-0 flex flex-col border-r border-border bg-sidebar-background transition-all duration-200 overflow-hidden',
              expanded ? 'w-56' : 'w-14'
            )}
          >
            {sidebarContent}
          </aside>
        )}

        <main className={cn('flex-1 overflow-hidden p-4 flex flex-col', isMobile && 'pt-16')}>
          <Outlet />
        </main>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Configurações da Empresa</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="text-base" /></div>
              <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm(p => ({ ...p, cnpj: e.target.value }))} className="text-base" /></div>
              <div><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="text-base" /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="text-base" /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="text-base" /></div>
              <div>
                <Label>Logo</Label>
                <Input type="file" accept="image/*" onChange={handleLogoUpload} />
                {form.logo && <img src={form.logo} alt="Logo" className="mt-2 h-16 object-contain" />}
              </div>
              <Button className="w-full min-h-[44px]" onClick={handleSave}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default RecibosLayout;

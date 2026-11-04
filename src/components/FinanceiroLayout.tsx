import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, LayoutDashboard, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/components/ThemeToggle';

const FinanceiroLayout = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const expanded = isMobile ? true : hovered;

  const handleExit = () => {
    sessionStorage.removeItem('financial_auth');
    navigate('/');
  };

  const sidebarContent = (
    <>
      <div className="px-3 py-4">
        <button onClick={() => { navigate('/recibos'); setMobileDrawerOpen(false); }} className="flex items-center gap-3 px-1 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md min-h-[44px]">
          <ArrowLeft className="h-5 w-5 shrink-0" />
          {expanded && <span className="whitespace-nowrap">Emissão Recibos</span>}
        </button>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {(() => {
          const link = (
            <NavLink
              to="/financeiro"
              end
              onClick={() => setMobileDrawerOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-1 py-2 rounded-md text-sm transition-colors whitespace-nowrap min-h-[44px]',
                isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <LayoutDashboard className="h-5 w-5 shrink-0" />
              {expanded && 'Painel Financeiro'}
            </NavLink>
          );
          return expanded ? link : (
            <Tooltip>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">Painel Financeiro</TooltipContent>
            </Tooltip>
          );
        })()}
      </nav>
      <div className="border-t border-border px-3 py-2 space-y-1">
        <ThemeToggle expanded={expanded} />
        {expanded ? (
          <Button variant="ghost" className="w-full justify-start gap-3 px-1 text-destructive min-h-[44px]" onClick={() => { handleExit(); setMobileDrawerOpen(false); }}>
            <LogOut className="h-5 w-5 shrink-0" /> Sair do Financeiro
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" className="w-full justify-start px-1 text-destructive min-h-[44px]" onClick={handleExit}>
                <LogOut className="h-5 w-5 shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair do Financeiro</TooltipContent>
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
            <span className="ml-2 text-sm font-medium text-foreground">Painel Financeiro</span>
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

        <main className={cn('flex-1 overflow-auto', isMobile && 'pt-12')}>
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
};

export default FinanceiroLayout;

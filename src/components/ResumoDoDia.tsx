import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, PackageCheck, Wallet, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { hojeBR, somarDias } from '@/lib/dataLocal';

/**
 * O que importa hoje, numa olhada só.
 *
 * O sistema abre junto com o Windows, então esta é a primeira tela do dia.
 * Antes ela só oferecia três botões; agora adianta o que exige atenção,
 * para não ser preciso entrar nos três módulos para descobrir.
 *
 * Dinheiro só aparece com o Financeiro desbloqueado nesta sessão. O módulo
 * é protegido por senha, e mostrar o total a receber aqui furaria essa
 * proteção para quem passar pela máquina do balcão.
 */

type Resumo = {
  venceHoje: number;
  atrasadas: number;
  aguardandoRetirada: number;
  aReceber: { total: number; qtd: number } | null;
};

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ResumoDoDia = () => {
  const navigate = useNavigate();
  const [r, setR] = useState<Resumo | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const agora = new Date();
        const fimDeHoje = new Date(
          agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
        const inicioDeHoje = new Date(
          agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);

        const { data: demandas, error } = await supabase
          .from('demandas')
          .select('prazo, status, retirado');
        if (error) throw error;

        let venceHoje = 0, atrasadas = 0, aguardandoRetirada = 0;
        for (const d of demandas ?? []) {
          const concluida = d.status === 'concluido';
          if (concluida) {
            if (!d.retirado) aguardandoRetirada++;
            continue;
          }
          if (!d.prazo) continue;
          const p = new Date(d.prazo);
          if (p < inicioDeHoje) atrasadas++;
          else if (p <= fimDeHoje) venceHoje++;
        }

        // Só consulta o Financeiro se ele já foi aberto nesta sessão.
        let aReceber: Resumo['aReceber'] = null;
        if (sessionStorage.getItem('financial_auth')) {
          const hoje = hojeBR(agora);
          const { data: inv } = await supabase
            .from('financial_invoices')
            .select('value, due_date, status, entity_type')
            .neq('status', 'paid')
            .eq('entity_type', 'client')
            .lt('due_date', hoje);
          if (inv?.length) {
            aReceber = {
              total: inv.reduce((s, i) => s + (Number(i.value) || 0), 0),
              qtd: inv.length,
            };
          } else {
            aReceber = { total: 0, qtd: 0 };
          }
        }

        if (vivo) setR({ venceHoje, atrasadas, aguardandoRetirada, aReceber });
      } catch (e) {
        console.error('Resumo do dia:', e);
        // Um resumo que falha não pode atrapalhar o acesso aos módulos:
        // some da tela e os três cartões continuam ali embaixo.
        if (vivo) setErro(true);
      }
    })();

    return () => { vivo = false; };
  }, []);

  if (erro) return null;

  if (!r) {
    return (
      <div className="flex items-center justify-center gap-2 h-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> carregando o dia…
      </div>
    );
  }

  const nada = r.venceHoje === 0 && r.atrasadas === 0 && r.aguardandoRetirada === 0
    && (r.aReceber?.qtd ?? 0) === 0;

  if (nada) {
    return (
      <p className="text-sm text-muted-foreground text-center h-20 flex items-center justify-center">
        Nada vencendo hoje e nada atrasado. Bom dia de trabalho.
      </p>
    );
  }

  const Bloco = ({ icone, valor, rotulo, cor, onClick }: {
    icone: React.ReactNode; valor: string; rotulo: string; cor: string; onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border
        bg-card hover:bg-secondary/60 transition text-left min-w-[150px]"
    >
      <span className={cor}>{icone}</span>
      <span>
        <span className="block text-xl font-semibold leading-tight">{valor}</span>
        <span className="block text-xs text-muted-foreground">{rotulo}</span>
      </span>
    </button>
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
      {r.atrasadas > 0 && (
        <Bloco
          icone={<AlertTriangle className="h-5 w-5" />}
          cor="text-destructive"
          valor={String(r.atrasadas)}
          rotulo={r.atrasadas === 1 ? 'demanda atrasada' : 'demandas atrasadas'}
          onClick={() => navigate('/demandas')}
        />
      )}
      {r.venceHoje > 0 && (
        <Bloco
          icone={<Clock className="h-5 w-5" />}
          cor="text-warning"
          valor={String(r.venceHoje)}
          rotulo={r.venceHoje === 1 ? 'vence hoje' : 'vencem hoje'}
          onClick={() => navigate('/demandas')}
        />
      )}
      {r.aguardandoRetirada > 0 && (
        <Bloco
          icone={<PackageCheck className="h-5 w-5" />}
          cor="text-primary"
          valor={String(r.aguardandoRetirada)}
          rotulo={r.aguardandoRetirada === 1 ? 'pronta para retirar' : 'prontas para retirar'}
          onClick={() => navigate('/demandas')}
        />
      )}
      {r.aReceber && r.aReceber.qtd > 0 && (
        <Bloco
          icone={<Wallet className="h-5 w-5" />}
          cor="text-destructive"
          valor={fmtMoeda(r.aReceber.total)}
          rotulo={`em atraso · ${r.aReceber.qtd} título${r.aReceber.qtd > 1 ? 's' : ''}`}
          onClick={() => navigate('/financeiro')}
        />
      )}
    </div>
  );
};

export default ResumoDoDia;

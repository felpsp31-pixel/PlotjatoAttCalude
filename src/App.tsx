import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { RecibosProvider } from "@/contexts/RecibosContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import SystemGuard from "@/components/SystemGuard";
import FinanceiroGuard from "@/components/FinanceiroGuard";

// Eager-load light pages (login + home) for instant first paint
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";

// Lazy-load heavy pages and layouts (jspdf, recharts, kanban, etc.)
const FinanceiroLayout = lazy(() => import("@/components/FinanceiroLayout"));
const RecibosLayout = lazy(() => import("@/components/recibos/RecibosLayout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const EmissaoReciboPage = lazy(() => import("./pages/recibos/EmissaoReciboPage"));
const ClientesReciboPage = lazy(() => import("./pages/recibos/ClientesReciboPage"));
const ServicosReciboPage = lazy(() => import("./pages/recibos/ServicosReciboPage"));
const DashboardReciboPage = lazy(() => import("./pages/recibos/DashboardReciboPage"));
const RelatoriosReciboPage = lazy(() => import("./pages/recibos/RelatoriosReciboPage"));
const DemandasPage = lazy(() => import("./pages/recibos/DemandasPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Prefetch heavy routes in idle time so the first navigation feels instant.
if (typeof window !== "undefined") {
  const idle = (cb: () => void) =>
    "requestIdleCallback" in window
      ? (window as any).requestIdleCallback(cb, { timeout: 2000 })
      : setTimeout(cb, 1500);
  idle(() => {
    import("@/components/recibos/RecibosLayout");
    import("./pages/recibos/EmissaoReciboPage");
    import("./pages/recibos/ClientesReciboPage");
    import("./pages/recibos/ServicosReciboPage");
    import("./pages/recibos/DemandasPage");
  });
  idle(() => {
    import("@/components/FinanceiroLayout");
    import("./pages/Dashboard");
    import("./pages/recibos/DashboardReciboPage");
    import("./pages/recibos/RelatoriosReciboPage");
  });
}

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" closeButton />
      <AuthProvider>
        <RecibosProvider>
          <BrowserRouter>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />

                {/* All routes below require system auth */}
                <Route element={<SystemGuard />}>
                  <Route path="/" element={<HomePage />} />

                  {/* Recibos module */}
                  <Route path="/recibos" element={<RecibosLayout />}>
                    <Route index element={<EmissaoReciboPage />} />
                    <Route path="clientes" element={<ClientesReciboPage />} />
                    <Route path="servicos" element={<ServicosReciboPage />} />
                    <Route path="dashboard" element={<DashboardReciboPage />} />
                    <Route path="relatorios" element={<RelatoriosReciboPage />} />
                  </Route>

                  {/* Demandas module */}
                  <Route path="/demandas" element={<DemandasPage />} />

                  {/* Financial module */}
                  <Route path="/financeiro" element={<FinanceiroGuard />}>
                    <Route element={<FinanceiroLayout />}>
                      <Route index element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    </Route>
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </RecibosProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

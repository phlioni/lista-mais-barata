import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ListDetail from "./pages/ListDetail";
import Compare from "./pages/Compare";
import Markets from "./pages/Markets";
import Profile from "./pages/Profile";
import PriceManager from "./pages/PriceManager";
import CreateMarket from "./pages/CreateMarket";
import Gamification from "./pages/Gamification";
import Settings from "./pages/Settings";
import Community from "./pages/Community";
import PublicMarketDetail from "./pages/PublicMarketDetail"; // Nova Tela Pública

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Gamification />} />
            <Route path="/listas" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/lista/:id" element={<ListDetail />} />
            <Route path="/mercado/:marketId/:listId" element={<ListDetail />} />
            <Route path="/comparar/:id" element={<Compare />} />
            <Route path="/mercados" element={<Markets />} />
            <Route path="/mercados/novo" element={<CreateMarket />} />
            <Route path="/perfil" element={<Profile />} />
            <Route path="/configuracoes" element={<Settings />} />
            <Route path="/precos" element={<PriceManager />} />

            {/* Novas Rotas de Comunidade */}
            <Route path="/comunidade" element={<Community />} />
            <Route path="/ver-mercado/:id" element={<PublicMarketDetail />} /> {/* Rota Pública */}

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
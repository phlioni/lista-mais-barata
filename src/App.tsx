import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Markets from "./pages/Markets";
import MarketDetail from "./pages/MarketDetail";
import CreateMarket from "./pages/CreateMarket";
import ListDetail from "./pages/ListDetail";
import NotFound from "./pages/NotFound";
import Compare from "./pages/Compare";
import Community from "./pages/Community";
import Gamification from "./pages/Gamification";
import Arenas from "./pages/Arenas";
import Settings from "./pages/Settings";

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
            <Route path="/auth" element={<Auth />} />
            <Route path="/perfil" element={<Profile />} />

            

            <Route path="/mercados" element={<Markets />} />
            <Route path="/mercados/novo" element={<CreateMarket />} />
            <Route path="/ver-mercado/:id" element={<MarketDetail />} />

            <Route path="/listas" element={<Index />} />
            <Route path="/lista/:id" element={<ListDetail />} />
            <Route path="/comparar/:id" element={<Compare />} />

            <Route path="/comunidade" element={<Community />} />

            <Route path="/arenas" element={<Arenas />} />

            <Route path="/configuracoes" element={<Settings />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
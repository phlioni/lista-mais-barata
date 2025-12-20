import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ListDetail from "./pages/ListDetail";
import Markets from "./pages/Markets";
import Profile from "./pages/Profile";
import Compare from "./pages/Compare";
import MarketDetail from "./pages/MarketDetail";
import PriceManager from "./pages/PriceManager";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/lista/:id" element={<ListDetail />} />
            <Route path="/mercados" element={<Markets />} />
            <Route path="/perfil" element={<Profile />} />
            <Route path="/comparar/:id" element={<Compare />} />
            <Route path="/mercado/:marketId/:listId" element={<MarketDetail />} />
            <Route path="/precos" element={<PriceManager />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

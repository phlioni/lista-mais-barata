import { useState, useEffect } from "react";
import { Plus, MapPin, Store, Loader2, Search, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppMenu } from "@/components/AppMenu";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MarketCard } from "@/components/MarketCard";

interface Market {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  owner_id?: string; // Novo campo para saber quem manda
}

export default function Markets() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchMarkets();
    }
  }, [user]);

  const fetchMarkets = async () => {
    setLoading(true);
    try {
      // 1. Busca Mercados
      const { data: marketsData, error } = await supabase
        .from("markets")
        .select("*")
        .order("name");

      if (error) throw error;

      // 2. Busca os "Donos" (Top 1 score de cada mercado)
      // Nota: Em produção com muitos dados, isso seria uma View SQL.
      // Para agora, vamos buscar os scores e calcular.
      const { data: scores } = await supabase
        .from("market_scores")
        .select("market_id, user_id, score")
        .order("score", { ascending: false });

      // Cria mapa de proprietários: { market_id: user_id_do_lider }
      const ownersMap: Record<string, string> = {};

      if (scores) {
        scores.forEach((score) => {
          // Como está ordenado por score DESC, o primeiro que aparece é o dono
          if (!ownersMap[score.market_id]) {
            ownersMap[score.market_id] = score.user_id;
          }
        });
      }

      // 3. Mescla dados
      const marketsWithOwners = (marketsData || []).map((m) => ({
        ...m,
        owner_id: ownersMap[m.id]
      }));

      setMarkets(marketsWithOwners);
    } catch (error) {
      console.error("Error fetching markets:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os mercados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredMarkets = markets.filter((market) =>
    market.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Conta quantos territórios eu domino
  const myTerritoriesCount = markets.filter(m => m.owner_id === user?.id).length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="flex items-center justify-between px-4 py-4 max-w-md mx-auto sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Mercados</h1>
          <p className="text-xs text-muted-foreground">Encontre e domine territórios</p>
        </div>
        <div className="flex gap-2">
          {myTerritoriesCount > 0 && (
            <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-lg text-xs font-bold border border-yellow-200">
              <Crown className="w-3 h-3 fill-yellow-600 text-yellow-600" />
              {myTerritoriesCount}
            </div>
          )}
          <AppMenu />
        </div>
      </div>

      <main className="px-4 py-4 max-w-md mx-auto space-y-4">
        {/* Busca e Botão Novo */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar mercado..."
              className="pl-9 h-12 rounded-xl bg-secondary/30 border-transparent focus:bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={() => navigate("/mercados/novo")} className="h-12 w-12 rounded-xl shrink-0 p-0" variant="outline">
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredMarkets.length === 0 ? (
          <EmptyState
            icon={<Store className="w-10 h-10 text-primary" />}
            title="Nenhum mercado encontrado"
            description={searchTerm ? "Tente outro nome." : "Cadastre os mercados do seu bairro para começar a comparar preços"}
            action={
              <Button onClick={() => navigate("/mercados/novo")} className="h-12 rounded-xl">
                <Plus className="w-5 h-5 mr-2" />
                Cadastrar Mercado
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredMarkets.map((market, index) => (
              <div key={market.id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                <MarketCard
                  id={market.id}
                  name={market.name}
                  address={market.address}
                  // Se não tem listId, o card vai funcionar como link para detalhes do mercado
                  isOwner={market.owner_id === user?.id} // <--- AQUI ESTÁ A MÁGICA
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
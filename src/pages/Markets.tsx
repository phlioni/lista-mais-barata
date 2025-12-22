import { useState, useEffect } from "react";
import { Plus, MapPin, Store, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppMenu } from "@/components/AppMenu";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Market {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
}

export default function Markets() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

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
      const { data, error } = await supabase
        .from("markets")
        .select("*")
        .order("name");

      if (error) throw error;
      setMarkets(data || []);
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="flex items-center justify-between px-4 py-4 max-w-md mx-auto sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Mercados</h1>
          <p className="text-sm text-muted-foreground">Locais cadastrados</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Agora navega para a página dedicada ao invés de abrir Dialog */}
          <Button
            size="icon"
            variant="secondary"
            className="text-primary h-10 w-10 rounded-xl"
            onClick={() => navigate("/mercados/novo")}
          >
            <Plus className="w-6 h-6" />
          </Button>

          <AppMenu />
        </div>
      </div>

      <main className="px-4 py-4 max-w-md mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : markets.length === 0 ? (
          <EmptyState
            icon={<Store className="w-8 h-8 text-primary" />}
            title="Nenhum mercado cadastrado"
            description="Adicione mercados para começar a comparar preços"
            action={
              <Button onClick={() => navigate("/mercados/novo")} className="h-12 rounded-xl">
                <Plus className="w-5 h-5 mr-2" />
                Cadastrar Mercado
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {markets.map((market, index) => (
              <div
                key={market.id}
                className={cn(
                  "flex items-center gap-4 p-4 bg-card rounded-2xl border border-border shadow-soft",
                  "animate-slide-up"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 flex-shrink-0">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{market.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate mt-0.5">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    {market.address || `${market.latitude.toFixed(5)}, ${market.longitude.toFixed(5)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
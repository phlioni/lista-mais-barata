import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadiusSelector } from "@/components/RadiusSelector";
import { MarketCard } from "@/components/MarketCard";
import { EmptyState } from "@/components/EmptyState";
import { AppMenu } from "@/components/AppMenu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MarketResult {
  id: string;
  name: string;
  address: string | null;
  totalPrice: number;
  distance: number;
  missingItems: number;
  totalItems: number;
  coveragePercent: number;
  realCost: number;
  isRecommended: boolean;
  lastUpdate: string;
}

export default function Compare() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [listName, setListName] = useState("");
  const [radius, setRadius] = useState(5);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MarketResult[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id) {
      fetchListName();
    }
  }, [id]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          setUserLocation({ lat: -23.5505, lng: -46.6333 });
        }
      );
    } else {
      setUserLocation({ lat: -23.5505, lng: -46.6333 });
    }
  }, []);

  // Realtime update: Se houver mudança de preços, reexecuta a comparação
  useEffect(() => {
    if (!hasSearched) return;

    const channel = supabase
      .channel('compare-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'market_prices' },
        () => {
          console.log("Preço alterado externamente, recalculando...");
          compareMarkets(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasSearched, id, userLocation, radius]);

  const fetchListName = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("name")
        .eq("id", id)
        .single();
      if (error) throw error;
      setListName(data.name);
    } catch (error) {
      console.error("Error fetching list:", error);
    }
  };

  const compareMarkets = async (silent = false) => {
    if (!id || !userLocation) return;

    if (!silent) setLoading(true);
    setHasSearched(true);

    try {
      // Chamada para a nova Edge Function Inteligente
      const { data, error } = await supabase.functions.invoke('smart-compare', {
        body: {
          listId: id,
          userLocation: userLocation,
          radius: radius
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setResults(data.results || []);

    } catch (error) {
      console.error("Error comparing markets:", error);
      if (!silent) {
        toast({
          title: "Erro",
          description: "Não foi possível comparar os preços. Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 py-4 max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/lista/${id}`)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-display font-bold text-foreground">Comparar Preços</h1>
              <p className="text-sm text-muted-foreground">{listName}</p>
            </div>
          </div>
          <AppMenu />
        </div>
      </header>

      <main className="px-4 py-4 max-w-md mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <MapPin className="w-4 h-4" />
          <span>
            {userLocation
              ? `Sua localização detectada`
              : "Obtendo localização..."}
          </span>
        </div>

        <div className="mb-6">
          <p className="text-sm font-medium text-foreground mb-2">Raio de Busca:</p>
          <RadiusSelector value={radius} onChange={setRadius} />
        </div>

        <Button
          onClick={() => compareMarkets(false)}
          className="w-full h-14 mb-6"
          size="lg"
          disabled={loading || !userLocation}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Buscar Melhores Preços (Inteligente)
            </>
          )}
        </Button>

        {hasSearched && !loading && (
          <>
            {results.length === 0 ? (
              <EmptyState
                icon={<MapPin className="w-8 h-8 text-primary" />}
                title="Nenhum mercado viável"
                description={`Não encontramos mercados com produtos compatíveis em um raio de ${radius}km.`}
              />
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  {results.length} {results.length === 1 ? "mercado encontrado" : "mercados encontrados"}:
                </p>
                {results.map((result, index) => (
                  <MarketCard
                    key={result.id}
                    id={result.id}
                    listId={id!}
                    name={result.name}
                    address={result.address}
                    totalPrice={result.totalPrice}
                    distance={result.distance}
                    missingItems={result.missingItems}
                    rank={index + 1}
                    isRecommended={result.isRecommended}
                    lastUpdate={result.lastUpdate}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
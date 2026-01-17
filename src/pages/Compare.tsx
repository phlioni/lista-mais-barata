import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Loader2, Sparkles, RefreshCw } from "lucide-react";
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
  substitutedItems: number; // NOVO CAMPO
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

  // RESTAURAÇÃO DE ESTADO (Cache da Busca)
  useEffect(() => {
    // Tenta recuperar do cache ao montar a tela
    const cachedData = sessionStorage.getItem(`compare-cache-${id}`);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        setResults(parsed.results);
        setRadius(parsed.radius);
        setHasSearched(true);
        // Se tiver localização salva, usa também, senão tenta pegar de novo
        if (parsed.userLocation) setUserLocation(parsed.userLocation);
      } catch (e) {
        console.error("Erro ao restaurar cache", e);
      }
    }

    // Geolocalização (se não tiver no cache ou para atualizar)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(newLoc);
        },
        () => {
          if (!userLocation) setUserLocation({ lat: -23.5505, lng: -46.6333 });
        }
      );
    } else {
      if (!userLocation) setUserLocation({ lat: -23.5505, lng: -46.6333 });
    }
  }, [id]);

  // SALVAR NO CACHE
  useEffect(() => {
    if (hasSearched && results.length > 0 && id) {
      const cacheData = {
        results,
        radius,
        userLocation,
        timestamp: Date.now()
      };
      sessionStorage.setItem(`compare-cache-${id}`, JSON.stringify(cacheData));
    }
  }, [results, radius, userLocation, hasSearched, id]);

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

  const handleNewSearch = () => {
    // Limpa cache explicitamente se o usuário quiser nova busca
    sessionStorage.removeItem(`compare-cache-${id}`);
    compareMarkets();
  };

  const compareMarkets = async (silent = false) => {
    if (!id || !userLocation) return;

    if (!silent) setLoading(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke('smart-shopping-analysis', {
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
          onClick={handleNewSearch}
          className="w-full h-14 mb-6 shadow-lg shadow-primary/20"
          size="lg"
          disabled={loading || !userLocation}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {hasSearched ? <RefreshCw className="w-5 h-5 mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
              {hasSearched ? "Atualizar Busca" : "Buscar Melhores Preços"}
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
              <div className="space-y-3 animate-fade-in">
                <div className="flex justify-between items-center px-1">
                  <p className="text-sm font-medium text-foreground">
                    {results.length} {results.length === 1 ? "mercado encontrado" : "mercados encontrados"}
                  </p>
                  <span className="text-xs text-muted-foreground">Ordenado por melhor opção</span>
                </div>

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
                    substitutedItems={result.substitutedItems} // PASSANDO A NOVA PROPRIEDADE
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
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

interface ListItem {
  id: string;
  product_id: string;
  quantity: number;
  products: {
    id: string;
    name: string;
  };
}

interface Market {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
}

interface MarketPrice {
  market_id: string;
  product_id: string;
  price: number;
  created_at: string; // Garantindo que temos o campo de data
}

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
  lastUpdate: string; // Novo campo para a data
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

  useEffect(() => {
    if (!hasSearched) return;

    const channel = supabase
      .channel('compare-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'market_prices' },
        (payload) => {
          console.log("Preço alterado externamente, recalculando...", payload);
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
      const { data: itemsData, error: itemsError } = await supabase
        .from("list_items")
        .select(`
          id,
          product_id,
          quantity,
          products (id, name)
        `)
        .eq("list_id", id);

      if (itemsError) throw itemsError;
      const items = itemsData as ListItem[];

      if (items.length === 0) {
        if (!silent) {
          toast({
            title: "Lista vazia",
            description: "Adicione produtos à lista antes de comparar",
            variant: "destructive",
          });
        }
        setLoading(false);
        return;
      }

      const { data: marketsData, error: marketsError } = await supabase
        .from("markets")
        .select("*");

      if (marketsError) throw marketsError;

      const marketsInRadius = (marketsData as Market[]).filter((market) => {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          market.latitude,
          market.longitude
        );
        return distance <= radius;
      });

      if (marketsInRadius.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      const productIds = items.map((item) => item.product_id);
      const marketIds = marketsInRadius.map((market) => market.id);

      const { data: pricesData, error: pricesError } = await supabase
        .from("market_prices")
        .select("*")
        .in("market_id", marketIds)
        .in("product_id", productIds);

      if (pricesError) throw pricesError;
      const prices = pricesData as MarketPrice[];

      const marketResults: MarketResult[] = marketsInRadius.map((market) => {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          market.latitude,
          market.longitude
        );

        let totalPrice = 0;
        let missingItems = 0;

        // Array para coletar as datas dos preços encontrados neste mercado
        const foundPriceDates: string[] = [];

        items.forEach((item) => {
          const priceEntry = prices.find(
            (p) => p.market_id === market.id && p.product_id === item.product_id
          );

          if (priceEntry) {
            totalPrice += priceEntry.price * item.quantity;
            foundPriceDates.push(priceEntry.created_at);
          } else {
            missingItems++;
          }
        });

        // Encontra a data mais recente entre os preços
        let lastUpdate = new Date().toISOString(); // Default fallback
        if (foundPriceDates.length > 0) {
          // Ordena descrescente e pega a primeira (mais recente)
          foundPriceDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          lastUpdate = foundPriceDates[0];
        }

        const coveragePercent = Math.round(((items.length - missingItems) / items.length) * 100);
        const travelCost = distance * 2 * 1.5;
        const realCost = totalPrice + travelCost;

        return {
          id: market.id,
          name: market.name,
          address: market.address,
          totalPrice,
          distance,
          missingItems,
          totalItems: items.length,
          coveragePercent,
          realCost,
          isRecommended: false,
          lastUpdate, // Passando a data calculada
        };
      });

      const viableMarkets = marketResults.filter(
        (m) => m.totalPrice > 0 && m.coveragePercent >= 30
      );

      viableMarkets.sort((a, b) => {
        if (a.missingItems === 0 && b.missingItems > 0) return -1;
        if (b.missingItems === 0 && a.missingItems > 0) return 1;
        return a.realCost - b.realCost;
      });

      if (viableMarkets.length > 0) {
        let recommendedIndex = 0;
        const completeMarkets = viableMarkets.filter(m => m.missingItems === 0);

        if (completeMarkets.length > 0) {
          const bestComplete = completeMarkets[0];
          const priceDiff = viableMarkets[0].realCost - bestComplete.realCost;
          if (priceDiff < 0 || (viableMarkets[0].missingItems > 0 && priceDiff / viableMarkets[0].realCost < 0.2)) {
            recommendedIndex = viableMarkets.findIndex(m => m.id === bestComplete.id);
          }
        }
        if (viableMarkets[recommendedIndex]) {
          viableMarkets[recommendedIndex].isRecommended = true;
        }
      }

      setResults(viableMarkets.slice(0, 5));
    } catch (error) {
      console.error("Error comparing markets:", error);
      if (!silent) {
        toast({
          title: "Erro",
          description: "Não foi possível comparar os preços",
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
              Buscar Melhores Preços
            </>
          )}
        </Button>

        {hasSearched && !loading && (
          <>
            {results.length === 0 ? (
              <EmptyState
                icon={<MapPin className="w-8 h-8 text-primary" />}
                title="Nenhum mercado encontrado"
                description={`Não há mercados com preços cadastrados em um raio de ${radius}km`}
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
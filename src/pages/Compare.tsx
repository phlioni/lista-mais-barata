import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Loader2, Search, Sparkles, Brain, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadiusSelector } from "@/components/RadiusSelector";
import { MarketCard } from "@/components/MarketCard";
import { EmptyState } from "@/components/EmptyState";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
}

interface MarketPrice {
  market_id: string;
  product_id: string;
  price: number;
}

interface MarketResult {
  id: string;
  name: string;
  totalPrice: number;
  distance: number;
  missingItems: number;
  totalItems: number;
  products: Array<{ name: string; price: number | null; quantity: number }>;
  travelCost?: number;
  realCost?: number;
  coveragePercent?: number;
}

interface SmartRecommendation {
  type: string;
  message: string;
  markets: MarketResult[];
  bestOption: MarketResult | null;
  analysis: {
    totalMarketsAnalyzed: number;
    marketsWithPrices: number;
    viableMarkets: number;
  } | null;
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
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
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<MarketResult[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [smartRecommendation, setSmartRecommendation] = useState<SmartRecommendation | null>(null);

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
    // Try to get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Default to São Paulo center if location not available
          setUserLocation({ lat: -23.5505, lng: -46.6333 });
        }
      );
    } else {
      setUserLocation({ lat: -23.5505, lng: -46.6333 });
    }
  }, []);

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

  const compareMarkets = async () => {
    if (!id || !userLocation) return;

    setLoading(true);
    setHasSearched(true);
    setSmartRecommendation(null);

    try {
      // Fetch list items
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
        toast({
          title: "Lista vazia",
          description: "Adicione produtos à lista antes de comparar",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Fetch all markets
      const { data: marketsData, error: marketsError } = await supabase
        .from("markets")
        .select("*");

      if (marketsError) throw marketsError;

      // Filter markets within radius
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

      // Fetch prices for all products in all markets within radius
      const productIds = items.map((item) => item.product_id);
      const marketIds = marketsInRadius.map((market) => market.id);

      const { data: pricesData, error: pricesError } = await supabase
        .from("market_prices")
        .select("*")
        .in("market_id", marketIds)
        .in("product_id", productIds);

      if (pricesError) throw pricesError;
      const prices = pricesData as MarketPrice[];

      // Calculate totals for each market
      const marketResults: MarketResult[] = marketsInRadius.map((market) => {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          market.latitude,
          market.longitude
        );

        const productDetails: Array<{ name: string; price: number | null; quantity: number }> = [];
        let totalPrice = 0;
        let missingItems = 0;

        items.forEach((item) => {
          const priceEntry = prices.find(
            (p) => p.market_id === market.id && p.product_id === item.product_id
          );

          if (priceEntry) {
            const itemTotal = priceEntry.price * item.quantity;
            totalPrice += itemTotal;
            productDetails.push({
              name: item.products.name,
              price: priceEntry.price,
              quantity: item.quantity,
            });
          } else {
            missingItems++;
            productDetails.push({
              name: item.products.name,
              price: null,
              quantity: item.quantity,
            });
          }
        });

        return {
          id: market.id,
          name: market.name,
          totalPrice,
          distance,
          missingItems,
          totalItems: items.length,
          products: productDetails,
        };
      });

      setResults(marketResults);
      setLoading(false);

      // Now run smart analysis
      await runSmartAnalysis(marketResults, userLocation);

    } catch (error) {
      console.error("Error comparing markets:", error);
      toast({
        title: "Erro",
        description: "Não foi possível comparar os preços",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const runSmartAnalysis = async (markets: MarketResult[], location: { lat: number; lng: number }) => {
    setAnalyzing(true);

    try {
      const response = await supabase.functions.invoke('smart-shopping-analysis', {
        body: { markets, userLocation: location }
      });

      if (response.error) {
        console.error('Smart analysis error:', response.error);
        toast({
          title: "Análise indisponível",
          description: "Não foi possível gerar recomendações inteligentes",
          variant: "destructive",
        });
        return;
      }

      if (response.data?.recommendation) {
        setSmartRecommendation(response.data.recommendation);
        
        // Update results with smart-sorted markets if available
        if (response.data.recommendation.markets?.length > 0) {
          setResults(response.data.recommendation.markets);
        }
      }
    } catch (error) {
      console.error('Error running smart analysis:', error);
    } finally {
      setAnalyzing(false);
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
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-4 max-w-md mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/lista/${id}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-foreground">Comparar Preços</h1>
            <p className="text-sm text-muted-foreground">{listName}</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 max-w-md mx-auto">
        {/* Location Status */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <MapPin className="w-4 h-4" />
          <span>
            {userLocation 
              ? `Sua localização: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
              : "Obtendo localização..."}
          </span>
        </div>

        {/* Radius Selector */}
        <div className="mb-6">
          <p className="text-sm font-medium text-foreground mb-2">Raio de Busca:</p>
          <RadiusSelector value={radius} onChange={setRadius} />
        </div>

        {/* Search Button */}
        <Button
          onClick={compareMarkets}
          className="w-full h-14 mb-6"
          size="lg"
          disabled={loading || analyzing || !userLocation}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : analyzing ? (
            <>
              <Brain className="w-5 h-5 animate-pulse" />
              Analisando...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Buscar com IA
            </>
          )}
        </Button>

        {/* Smart Recommendation */}
        {smartRecommendation && smartRecommendation.type !== "no_data" && (
          <div className="mb-6 animate-fade-in">
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-4 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Análise Inteligente</h3>
              </div>
              <div className="prose prose-sm text-muted-foreground whitespace-pre-wrap">
                {smartRecommendation.message}
              </div>
              {smartRecommendation.analysis && (
                <div className="mt-4 pt-3 border-t border-border/50 flex gap-4 text-xs text-muted-foreground">
                  <span>{smartRecommendation.analysis.totalMarketsAnalyzed} mercados analisados</span>
                  <span>{smartRecommendation.analysis.viableMarkets} viáveis</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No Data Message */}
        {smartRecommendation?.type === "no_data" && (
          <div className="mb-6 animate-fade-in">
            <div className="bg-warning/10 rounded-2xl p-4 border border-warning/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-warning" />
                <h3 className="font-semibold text-foreground">Sem dados suficientes</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {smartRecommendation.message}
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {hasSearched && !loading && (
          <>
            {results.length === 0 ? (
              <EmptyState
                icon={<MapPin className="w-8 h-8 text-primary" />}
                title="Nenhum mercado encontrado"
                description={`Não há mercados cadastrados em um raio de ${radius}km da sua localização`}
              />
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  {smartRecommendation?.markets?.length 
                    ? `Top ${results.length} recomendados:`
                    : `${results.length} mercados encontrados:`
                  }
                </p>
                {results.map((result, index) => (
                  <MarketCard
                    key={result.id}
                    id={result.id}
                    listId={id!}
                    name={result.name}
                    totalPrice={result.totalPrice}
                    distance={result.distance}
                    missingItems={result.missingItems}
                    rank={index + 1}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

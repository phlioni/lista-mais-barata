import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, MapPin, Navigation, Store, ExternalLink, AlertTriangle, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getAddressFromCoordinates } from "@/lib/geocoding";

interface Market {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
}

interface ProductPrice {
  name: string;
  brand: string | null;
  quantity: number;
  price: number | null;
}

export default function MarketDetail() {
  const { marketId, listId } = useParams<{ marketId: string; listId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [market, setMarket] = useState<Market | null>(null);
  const [products, setProducts] = useState<ProductPrice[]>([]);
  const [loading, setLoading] = useState(true);
  
  const distance = parseFloat(searchParams.get("distance") || "0");
  const totalPrice = parseFloat(searchParams.get("total") || "0");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && marketId && listId) {
      fetchMarketDetails();
    }
  }, [user, marketId, listId]);

  const fetchMarketDetails = async () => {
    if (!marketId || !listId) return;

    setLoading(true);
    try {
      // Fetch market info
      const { data: marketData, error: marketError } = await supabase
        .from("markets")
        .select("*")
        .eq("id", marketId)
        .single();

      if (marketError) throw marketError;
      
      // If market has no address, try to fetch it
      let marketWithAddress = marketData;
      if (!marketData.address) {
        const address = await getAddressFromCoordinates(marketData.latitude, marketData.longitude);
        if (address) {
          // Update market with address in database
          await supabase
            .from("markets")
            .update({ address })
            .eq("id", marketId);
          marketWithAddress = { ...marketData, address };
        }
      }
      
      setMarket(marketWithAddress);

      // Fetch list items with products
      const { data: itemsData, error: itemsError } = await supabase
        .from("list_items")
        .select(`
          id,
          product_id,
          quantity,
          products (id, name, brand)
        `)
        .eq("list_id", listId);

      if (itemsError) throw itemsError;

      // Fetch prices for this market
      const productIds = itemsData.map((item: any) => item.product_id);
      const { data: pricesData, error: pricesError } = await supabase
        .from("market_prices")
        .select("product_id, price")
        .eq("market_id", marketId)
        .in("product_id", productIds);

      if (pricesError) throw pricesError;

      // Combine data
      const productPrices: ProductPrice[] = itemsData.map((item: any) => {
        const priceEntry = pricesData.find((p: any) => p.product_id === item.product_id);
        return {
          name: item.products.name,
          brand: item.products.brand,
          quantity: item.quantity,
          price: priceEntry?.price || null,
        };
      });

      setProducts(productPrices);
    } catch (error) {
      console.error("Error fetching market details:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os detalhes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openGoogleMaps = () => {
    if (!market) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${market.latitude},${market.longitude}`;
    window.open(url, "_blank");
  };

  const useThisList = () => {
    if (!market || !listId) return;
    // Navigate to list detail with market pre-selected and prices from this market
    navigate(`/lista/${listId}?marketId=${market.id}&usePrices=true`);
  };

  const calculatedTotal = products.reduce((acc, p) => {
    if (p.price) {
      return acc + (p.price * p.quantity);
    }
    return acc;
  }, 0);

  const missingItems = products.filter(p => !p.price).length;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Mercado não encontrado</p>
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
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-foreground">{market.name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {distance > 0 ? `${distance.toFixed(1)} km de distância` : "Localização salva"}
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 max-w-md mx-auto">
        {/* Market Info Card */}
        <div className="bg-card rounded-2xl border border-border shadow-soft p-4 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
              <Store className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-foreground">{market.name}</h2>
              {market.address ? (
                <p className="text-sm text-muted-foreground">{market.address}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  📍 {market.latitude.toFixed(5)}, {market.longitude.toFixed(5)}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={useThisList}
              className="w-full h-12"
            >
              <ShoppingCart className="w-5 h-5" />
              Usar Esta Lista
            </Button>
            <Button
              onClick={openGoogleMaps}
              className="w-full h-12"
              variant="outline"
            >
              <Navigation className="w-5 h-5" />
              Abrir no Google Maps
              <ExternalLink className="w-4 h-4 ml-auto" />
            </Button>
          </div>
        </div>

        {/* Price Summary */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground">Total estimado</span>
            <span className="text-2xl font-bold text-primary">
              R$ {(totalPrice || calculatedTotal).toFixed(2)}
            </span>
          </div>
          {missingItems > 0 && (
            <div className="flex items-center gap-2 text-warning text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{missingItems} {missingItems === 1 ? "item sem preço" : "itens sem preço"}</span>
            </div>
          )}
        </div>

        {/* Products List */}
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">Itens da Lista</h3>
          
          {products.map((product, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center justify-between p-3 bg-card rounded-xl border border-border",
                "animate-slide-up"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium",
                  product.price ? "text-foreground" : "text-muted-foreground"
                )}>
                  {product.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {product.brand && <span>{product.brand}</span>}
                  <span>Qtd: {product.quantity}</span>
                </div>
              </div>
              
              <div className="text-right">
                {product.price ? (
                  <>
                    <p className="font-bold text-primary">
                      R$ {product.price.toFixed(2)}
                    </p>
                    {product.quantity > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Total: R$ {(product.price * product.quantity).toFixed(2)}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-1 text-warning">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">Sem preço</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

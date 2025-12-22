import { useState, useEffect } from "react";
import { ArrowLeft, Store, Loader2, Save, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppMenu } from "@/components/AppMenu"; // Menu Lateral
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  brand: string | null;
}

interface Market {
  id: string;
  name: string;
}

interface MarketPrice {
  id: string;
  product_id: string;
  price: number;
}

export default function PriceManager() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [existingPrices, setExistingPrices] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedMarket) {
      fetchMarketPrices();
    }
  }, [selectedMarket]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [marketsRes, productsRes] = await Promise.all([
        supabase.from("markets").select("id, name").order("name"),
        supabase.from("products").select("id, name, brand").order("name"),
      ]);

      if (marketsRes.error) throw marketsRes.error;
      if (productsRes.error) throw productsRes.error;

      setMarkets(marketsRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketPrices = async () => {
    if (!selectedMarket) return;

    try {
      const { data, error } = await supabase
        .from("market_prices")
        .select("id, product_id, price")
        .eq("market_id", selectedMarket);

      if (error) throw error;
      setExistingPrices(data || []);

      const priceMap: Record<string, string> = {};
      (data || []).forEach((price) => {
        priceMap[price.product_id] = price.price.toString();
      });
      setPrices(priceMap);
    } catch (error) {
      console.error("Error fetching prices:", error);
    }
  };

  const handlePriceChange = (productId: string, value: string) => {
    setPrices((prev) => ({
      ...prev,
      [productId]: value,
    }));
  };

  const savePrices = async () => {
    if (!selectedMarket) return;

    setSaving(true);
    try {
      const upsertData = Object.entries(prices)
        .filter(([_, price]) => price && parseFloat(price) > 0)
        .map(([productId, price]) => ({
          market_id: selectedMarket,
          product_id: productId,
          price: parseFloat(price),
        }));

      if (upsertData.length === 0) {
        toast({
          title: "Nenhum preço para salvar",
          description: "Informe pelo menos um preço válido",
          variant: "default",
        });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("market_prices")
        .upsert(upsertData, {
          onConflict: "market_id,product_id",
        });

      if (error) throw error;

      fetchMarketPrices();
    } catch (error) {
      console.error("Error saving prices:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar os preços",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header Atualizado */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 py-4 max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/perfil")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-display font-bold text-foreground">Gerenciar Preços</h1>
              <p className="text-sm text-muted-foreground">Adicionar preços aos mercados</p>
            </div>
          </div>
          <AppMenu />
        </div>
      </header>

      <main className="px-4 py-4 max-w-md mx-auto">
        <div className="mb-6">
          <p className="text-sm font-medium text-foreground mb-2">Selecione o mercado:</p>
          <Select value={selectedMarket} onValueChange={setSelectedMarket}>
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue placeholder="Escolha um mercado" />
            </SelectTrigger>
            <SelectContent>
              {markets.map((market) => (
                <SelectItem key={market.id} value={market.id}>
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-primary" />
                    {market.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {markets.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum mercado cadastrado.</p>
            <p className="text-sm">Cadastre mercados primeiro na aba Mercados.</p>
          </div>
        )}

        {selectedMarket && (
          <>
            <div className="space-y-3 mb-6">
              <p className="text-sm font-medium text-foreground">Preços dos produtos:</p>
              {products.map((product, index) => (
                <div
                  key={product.id}
                  className={cn(
                    "flex items-center gap-3 p-3 bg-card rounded-xl border border-border",
                    "animate-slide-up"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{product.name}</p>
                    {product.brand && (
                      <p className="text-xs text-muted-foreground">{product.brand}</p>
                    )}
                  </div>
                  <div className="relative w-28">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={prices[product.id] || ""}
                      onChange={(e) => handlePriceChange(product.id, e.target.value)}
                      className="pl-7 h-10 rounded-lg text-right"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={savePrices}
              className="w-full h-14"
              size="lg"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Preços
                </>
              )}
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
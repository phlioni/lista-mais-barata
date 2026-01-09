import { useState, useEffect } from "react";
import { Check, MapPin, Search, Store, X, Plus, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";

// Função para calcular distância (Haversine Formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Raio da terra em KM
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distância em KM
  return d;
}

interface Market {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  distance?: number; // Campo calculado
}

interface MarketSelectorProps {
  selectedMarket: Market | null;
  onSelectMarket: (market: Market) => void;
}

export function MarketSelector({ selectedMarket, onSelectMarket }: MarketSelectorProps) {
  const [open, setOpen] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Ao abrir o modal, tenta pegar a localização
  useEffect(() => {
    if (open) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            setLocationError(false);
          },
          (error) => {
            console.error("Erro ao obter localização:", error);
            setLocationError(true);
            // Se falhar a localização, busca todos os mercados (fallback)
            fetchMarkets(null);
          }
        );
      } else {
        setLocationError(true);
        fetchMarkets(null);
      }
    }
  }, [open]);

  // Busca mercados quando a localização estiver disponível (ou se falhar)
  useEffect(() => {
    if (open && (userLocation || locationError)) {
      fetchMarkets(userLocation);
    }
  }, [open, userLocation, locationError]);

  async function fetchMarkets(currentUserLoc: { lat: number; lng: number } | null) {
    setLoading(true);
    try {
      // Precisamos selecionar latitude e longitude para o calculo
      const { data } = await supabase
        .from("markets")
        .select("id, name, address, latitude, longitude");

      if (data) {
        let processedMarkets = data.map((m) => ({
          ...m,
          // Se tiver localização do user, calcula. Senão, distância é infinita.
          distance: currentUserLoc
            ? calculateDistance(currentUserLoc.lat, currentUserLoc.lng, m.latitude, m.longitude)
            : 9999,
        }));

        // Se tivermos a localização do usuário, filtramos pelo raio de 10km
        if (currentUserLoc) {
          processedMarkets = processedMarkets.filter((m) => m.distance <= 10);
          // Ordena do mais perto para o mais longe
          processedMarkets.sort((a, b) => a.distance - b.distance);
        } else {
          // Se não tiver localização, ordena alfabeticamente
          processedMarkets.sort((a, b) => a.name.localeCompare(b.name));
        }

        setMarkets(processedMarkets);
      }
    } catch (error) {
      console.error("Error fetching markets:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredMarkets = markets.filter(market =>
    market.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (market.address && market.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelect = (market: Market) => {
    onSelectMarket(market);
    setOpen(false);
  };

  const handleCreateNew = () => {
    setOpen(false);
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    navigate(`/mercados/novo?returnTo=${returnUrl}`);
  };

  const getMarketDisplayName = (market: Market) => {
    if (!market.address) return market.name;
    return `${market.name} - ${market.address}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-14 px-4 rounded-xl border-border bg-card hover:bg-accent/50 group"
        >
          <div className="flex items-center gap-3 overflow-hidden w-full">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <Store className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col items-start truncate flex-1 min-w-0">
              <span className="text-xs text-muted-foreground font-medium">Mercado selecionado</span>
              <span className="text-sm font-semibold truncate w-full text-left text-foreground">
                {selectedMarket ? getMarketDisplayName(selectedMarket) : "Selecione um mercado..."}
              </span>
            </div>
          </div>
          <Search className="w-4 h-4 text-muted-foreground opacity-50 shrink-0 ml-2" />
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[95%] max-w-md rounded-2xl p-0 gap-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 border-b border-border/50">
          <DialogTitle>Escolha o Mercado</DialogTitle>
        </DialogHeader>

        <div className="p-4 pb-2">
          {/* Feedback de Localização */}
          {!userLocation && !locationError && (
            <div className="mb-2 text-xs text-muted-foreground flex items-center gap-1 animate-pulse">
              <Navigation className="w-3 h-3" /> Obtendo sua localização...
            </div>
          )}
          {locationError && (
            <div className="mb-2 text-xs text-orange-500 flex items-center gap-1">
              <Navigation className="w-3 h-3" /> Localização indisponível. Mostrando todos.
            </div>
          )}
          {userLocation && (
            <div className="mb-2 text-xs text-emerald-600 flex items-center gap-1 font-medium">
              <Navigation className="w-3 h-3" /> Mostrando mercados num raio de 10km
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou endereço..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 rounded-xl bg-secondary/30 border-transparent focus:bg-background focus:border-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[40vh] p-4 pt-0">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando mercados próximos...</div>
          ) : filteredMarkets.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {userLocation
                  ? "Nenhum mercado encontrado a menos de 10km."
                  : "Nenhum mercado encontrado."}
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={handleCreateNew}
                className="text-primary"
              >
                Cadastre este mercado agora
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMarkets.map((market) => (
                <button
                  key={market.id}
                  onClick={() => handleSelect(market)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all border",
                    selectedMarket?.id === market.id
                      ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                      : "bg-card border-border hover:border-primary/30 hover:bg-accent/50"
                  )}
                >
                  <div className="mt-0.5 bg-primary/10 p-1.5 rounded-lg shrink-0">
                    <MapPin className={cn(
                      "w-4 h-4",
                      selectedMarket?.id === market.id ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                      <p className={cn(
                        "font-medium leading-tight truncate",
                        selectedMarket?.id === market.id ? "text-primary" : "text-foreground"
                      )}>
                        {market.name}
                      </p>

                      {market.distance !== undefined && market.distance < 9000 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground whitespace-nowrap">
                          {market.distance < 1
                            ? `${Math.round(market.distance * 1000)}m`
                            : `${market.distance.toFixed(1)}km`}
                        </span>
                      )}
                    </div>

                    {market.address && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {market.address}
                      </p>
                    )}
                  </div>

                  {selectedMarket?.id === market.id && (
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-border bg-background z-10">
          <Button
            variant="secondary"
            className="w-full gap-2 h-12 rounded-xl border border-border/50 shadow-sm"
            onClick={handleCreateNew}
          >
            <Plus className="w-4 h-4" />
            Cadastrar novo mercado
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
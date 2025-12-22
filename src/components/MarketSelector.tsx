import { useState, useEffect } from "react";
import { Store, Plus, MapPin, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, calculateDistance } from "@/lib/utils";
import { useNavigate, useParams } from "react-router-dom"; // Import useNavigate e useParams

interface Market {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  distance?: number;
}

interface MarketSelectorProps {
  selectedMarket: Market | null;
  onSelectMarket: (market: Market) => void;
}

export function MarketSelector({ selectedMarket, onSelectMarket }: MarketSelectorProps) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState(false);

  const navigate = useNavigate(); // Hook para navegação
  const { id: listId } = useParams(); // Pega o ID da lista atual para voltar depois

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Erro ao obter localização:", error);
          setLocationError(true);
        }
      );
    } else {
      setLocationError(true);
    }
  }, []);

  useEffect(() => {
    if (userLocation || locationError) {
      fetchMarkets();
    }
  }, [userLocation, locationError]);

  const fetchMarkets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("markets")
        .select("*")
        .order("name");

      if (error) throw error;

      let processedMarkets = data || [];

      if (userLocation) {
        processedMarkets = processedMarkets
          .map((market) => ({
            ...market,
            distance: calculateDistance(
              userLocation.lat,
              userLocation.lng,
              market.latitude,
              market.longitude
            ),
          }))
          .filter((market) => market.distance <= 10)
          .sort((a, b) => a.distance - b.distance);
      }

      setMarkets(processedMarkets);
    } catch (error) {
      console.error("Error fetching markets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewMarket = () => {
    // Redireciona para a página de criação
    // Passa o ID da lista atual na URL (returnTo) para que a página de criação saiba voltar pra cá
    const returnUrl = listId ? `/lista/${listId}` : "/";
    navigate(`/mercados/novo?returnTo=${encodeURIComponent(returnUrl)}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full h-14 py-2 justify-between rounded-xl shadow-sm active:scale-[0.98] transition-all",
            selectedMarket && "border-primary text-primary bg-primary/5"
          )}
        >
          <div className="flex items-center gap-3 text-left overflow-hidden">
            <div className="p-2 bg-background rounded-full border border-border flex-shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate font-medium text-base">
                {selectedMarket ? selectedMarket.name : "Onde você vai comprar?"}
              </span>
              {selectedMarket?.address ? (
                <span className="block text-xs text-muted-foreground truncate font-normal">
                  {selectedMarket.address}
                </span>
              ) : !selectedMarket && userLocation ? (
                <span className="block text-xs text-muted-foreground font-normal">
                  Mostrando mercados próximos (10km)
                </span>
              ) : null}
            </div>
          </div>
          <ChevronDown className="w-5 h-5 opacity-50 flex-shrink-0 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[calc(100vw-2rem)] max-w-sm max-h-[60vh] overflow-y-auto rounded-xl"
        align="start"
        sideOffset={8}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Buscando mercados próximos...</p>
          </div>
        ) : markets.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm font-medium">Nenhum mercado próximo encontrado</p>
            <p className="text-xs mt-1">Tente cadastrar um novo mercado</p>
          </div>
        ) : (
          markets.map((market) => (
            <DropdownMenuItem
              key={market.id}
              onClick={() => onSelectMarket(market)}
              className={cn(
                "cursor-pointer flex-col items-start py-3 px-3 my-1 rounded-lg",
                selectedMarket?.id === market.id && "bg-primary/10 text-primary focus:bg-primary/15"
              )}
            >
              <div className="flex items-center justify-between w-full gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Store className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium truncate">{market.name}</span>
                </div>
                {market.distance !== undefined && (
                  <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground whitespace-nowrap">
                    {market.distance < 1
                      ? `${(market.distance * 1000).toFixed(0)}m`
                      : `${market.distance.toFixed(1)}km`}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground ml-6 truncate max-w-full block mt-0.5">
                {market.address || `${market.latitude.toFixed(5)}, ${market.longitude.toFixed(5)}`}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />

        {/* Atualizado para usar navegação */}
        <DropdownMenuItem
          onClick={handleCreateNewMarket}
          className="cursor-pointer text-primary py-3 justify-center font-medium hover:bg-primary/5 focus:bg-primary/5"
        >
          <Plus className="w-4 h-4 mr-2" />
          Cadastrar novo mercado
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
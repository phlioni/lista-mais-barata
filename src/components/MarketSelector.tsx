import { useState, useEffect } from "react";
import { Store, Plus, MapPin, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GoogleMap } from "@/components/GoogleMap";
import { getAddressFromCoordinates } from "@/lib/geocoding";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, calculateDistance } from "@/lib/utils";

interface Market {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  distance?: number; // Propriedade opcional para armazenar a distância calculada
}

interface MarketSelectorProps {
  selectedMarket: Market | null;
  onSelectMarket: (market: Market) => void;
}

export function MarketSelector({ selectedMarket, onSelectMarket }: MarketSelectorProps) {
  const { toast } = useToast();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMarketName, setNewMarketName] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [fetchedAddress, setFetchedAddress] = useState<string | null>(null);
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState(false);

  // Obter localização do usuário ao montar o componente
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
          // Se der erro, carregamos os mercados sem filtro de distância, ou com comportamento padrão
        }
      );
    } else {
      setLocationError(true);
    }
  }, []);

  // Buscar mercados quando a localização do usuário estiver disponível ou se der erro
  useEffect(() => {
    if (userLocation || locationError) {
      fetchMarkets();
    }
  }, [userLocation, locationError]);

  // Fetch address when selected location changes (criação de mercado)
  useEffect(() => {
    if (selectedLocation) {
      setFetchingAddress(true);
      getAddressFromCoordinates(selectedLocation.lat, selectedLocation.lng)
        .then((address) => {
          setFetchedAddress(address);
        })
        .finally(() => {
          setFetchingAddress(false);
        });
    } else {
      setFetchedAddress(null);
    }
  }, [selectedLocation]);

  const fetchMarkets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("markets")
        .select("*")
        .order("name");

      if (error) throw error;

      let processedMarkets = data || [];

      // Se temos a localização do usuário, filtramos por raio de 10km
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
          .filter((market) => market.distance <= 10) // Filtra raio de 10km
          .sort((a, b) => a.distance - b.distance); // Ordena do mais próximo ao mais distante
      }

      setMarkets(processedMarkets);
    } catch (error) {
      console.error("Error fetching markets:", error);
    } finally {
      setLoading(false);
    }
  };

  const createMarket = async () => {
    if (!newMarketName.trim() || !selectedLocation) {
      toast({
        title: "Dados incompletos",
        description: "Informe o nome e selecione a localização no mapa",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("markets")
        .insert({
          name: newMarketName.trim(),
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lng,
          address: fetchedAddress,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Mercado cadastrado!",
        description: `"${data.name}" foi adicionado`,
      });

      // Recalcular distância para o novo mercado se tiver localização
      let newMarket = data;
      if (userLocation) {
        const dist = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          data.latitude,
          data.longitude
        );
        newMarket = { ...data, distance: dist };
      }

      setNewMarketName("");
      setSelectedLocation(null);
      setFetchedAddress(null);
      setCreateDialogOpen(false);

      // Adiciona à lista. Se estiver fora do raio, logicamente não deveria aparecer, 
      // mas como o usuário acabou de criar, é boa UX mostrar.
      setMarkets((prev) => [...prev, newMarket].sort((a, b) =>
        (a.distance || 0) - (b.distance || 0)
      ));

      onSelectMarket(newMarket);
    } catch (error) {
      console.error("Error creating market:", error);
      toast({
        title: "Erro",
        description: "Não foi possível cadastrar o mercado",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full h-14 py-2 justify-between rounded-xl shadow-sm active:scale-[0.98] transition-all", // Otimização mobile: h-14 e rounded-xl
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
          className="w-[calc(100vw-2rem)] max-w-sm max-h-[60vh] overflow-y-auto rounded-xl" // Otimização mobile
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
                {market.address && (
                  <span className="text-xs text-muted-foreground ml-6 truncate max-w-full block mt-0.5">
                    {market.address}
                  </span>
                )}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setCreateDialogOpen(true)}
            className="cursor-pointer text-primary py-3 justify-center font-medium hover:bg-primary/5 focus:bg-primary/5"
          >
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar novo mercado
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="w-[90%] max-w-md mx-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-center">Cadastrar Mercado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Input
                placeholder="Nome do Mercado"
                value={newMarketName}
                onChange={(e) => setNewMarketName(e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>

            <div className="rounded-xl overflow-hidden border border-border">
              <p className="text-sm text-muted-foreground p-3 bg-muted/30">
                Selecione a localização no mapa:
              </p>
              <GoogleMap
                onLocationSelect={(lat, lng) => setSelectedLocation({ lat, lng })}
                selectedLocation={selectedLocation}
                className="h-56 w-full"
              />
            </div>

            {selectedLocation && (
              <div className="bg-muted/30 p-3 rounded-xl border border-border/50 text-center">
                {fetchingAddress ? (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Buscando endereço...
                  </p>
                ) : fetchedAddress ? (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <MapPin className="w-3 h-3 flex-shrink-0 text-primary" />
                    <span className="truncate">{fetchedAddress}</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <MapPin className="w-3 h-3" />
                    {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={createMarket}
              className="w-full h-12 text-base font-medium rounded-xl shadow-md"
              disabled={!newMarketName.trim() || !selectedLocation || creating}
            >
              {creating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5 mr-2" />
                  Cadastrar Mercado
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
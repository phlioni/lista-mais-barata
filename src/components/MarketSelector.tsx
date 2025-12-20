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
import { cn } from "@/lib/utils";

interface Market {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
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

  useEffect(() => {
    fetchMarkets();
  }, []);

  // Fetch address when location changes
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
      setMarkets(data || []);
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

      setNewMarketName("");
      setSelectedLocation(null);
      setFetchedAddress(null);
      setCreateDialogOpen(false);
      setMarkets([...markets, data]);
      onSelectMarket(data);
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
              "w-full h-auto min-h-12 py-2 justify-between",
              selectedMarket && "border-primary text-primary"
            )}
          >
            <div className="flex items-center gap-2 text-left">
              <Store className="w-5 h-5 flex-shrink-0" />
              <div className="min-w-0">
                <span className="block truncate">
                  {selectedMarket ? selectedMarket.name : "Selecionar mercado"}
                </span>
                {selectedMarket?.address && (
                  <span className="block text-xs text-muted-foreground truncate font-normal">
                    {selectedMarket.address}
                  </span>
                )}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[calc(100vw-2rem)] max-w-sm" align="start">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : markets.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <p className="text-sm">Nenhum mercado cadastrado</p>
            </div>
          ) : (
            markets.map((market) => (
              <DropdownMenuItem
                key={market.id}
                onClick={() => onSelectMarket(market)}
                className={cn(
                  "cursor-pointer flex-col items-start",
                  selectedMarket?.id === market.id && "bg-accent"
                )}
              >
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  <span>{market.name}</span>
                </div>
                {market.address && (
                  <span className="text-xs text-muted-foreground ml-6 truncate max-w-full">
                    {market.address}
                  </span>
                )}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setCreateDialogOpen(true)}
            className="cursor-pointer text-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar novo mercado
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Cadastrar Mercado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Nome do Mercado"
              value={newMarketName}
              onChange={(e) => setNewMarketName(e.target.value)}
              className="h-12 rounded-xl"
            />
            
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Selecione a localização:
              </p>
              <GoogleMap
                onLocationSelect={(lat, lng) => setSelectedLocation({ lat, lng })}
                selectedLocation={selectedLocation}
                className="h-48"
              />
            </div>

            {selectedLocation && (
              <div className="text-center">
                {fetchingAddress ? (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Buscando endereço...
                  </p>
                ) : fetchedAddress ? (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{fetchedAddress}</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={createMarket}
              className="w-full h-12"
              disabled={!newMarketName.trim() || !selectedLocation || creating}
            >
              {creating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5" />
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

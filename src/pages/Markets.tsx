import { useState, useEffect } from "react";
import { Plus, MapPin, Store, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { MapPlaceholder } from "@/components/MapPlaceholder";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getAddressFromCoordinates } from "@/lib/geocoding";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Market {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
}

export default function Markets() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMarketName, setNewMarketName] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [fetchedAddress, setFetchedAddress] = useState<string | null>(null);
  const [fetchingAddress, setFetchingAddress] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchMarkets();
    }
  }, [user]);

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
      toast({
        title: "Erro",
        description: "Não foi possível carregar os mercados",
        variant: "destructive",
      });
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
      setDialogOpen(false);
      fetchMarkets();
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader
        title="Mercados"
        subtitle="Locais cadastrados"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="text-primary">
                <Plus className="w-6 h-6" />
              </Button>
            </DialogTrigger>
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
                  <MapPlaceholder
                    onLocationSelect={(lat, lng) => setSelectedLocation({ lat, lng })}
                    selectedLocation={selectedLocation}
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
                      <p className="text-xs text-muted-foreground">
                        📍 {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
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
        }
      />

      <main className="px-4 py-4 max-w-md mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : markets.length === 0 ? (
          <EmptyState
            icon={<Store className="w-8 h-8 text-primary" />}
            title="Nenhum mercado cadastrado"
            description="Adicione mercados para começar a comparar preços"
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-5 h-5" />
                Cadastrar Mercado
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {markets.map((market, index) => (
              <div
                key={market.id}
                className={cn(
                  "flex items-center gap-4 p-4 bg-card rounded-2xl border border-border shadow-soft",
                  "animate-slide-up"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{market.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {market.address || `${market.latitude.toFixed(4)}, ${market.longitude.toFixed(4)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Loader2, Save } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapSelector } from "@/components/MapSelector";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getAddressFromCoordinates } from "@/lib/geocoding";

export default function CreateMarket() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();

    const returnTo = searchParams.get("returnTo");

    const [name, setName] = useState("");
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [fetchedAddress, setFetchedAddress] = useState<string | null>(null);
    const [fetchingAddress, setFetchingAddress] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate("/auth");
        }
    }, [user, authLoading, navigate]);

    // Busca endereço ao selecionar ponto no mapa
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

    const handleCreate = async () => {
        if (!name.trim() || !selectedLocation) {
            toast({
                title: "Dados incompletos",
                description: "Informe o nome e selecione a localização no mapa",
                variant: "destructive",
            });
            return;
        }

        setCreating(true);
        try {
            const addressToSave = fetchedAddress || `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`;

            // 1. Verificação de Duplicidade
            // Verificamos se já existe algum mercado com este exato endereço
            const { data: existingMarket, error: checkError } = await supabase
                .from("markets")
                .select("id, name")
                .eq("address", addressToSave)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existingMarket) {
                toast({
                    title: "Mercado já existe",
                    description: `O mercado "${existingMarket.name}" já está cadastrado neste endereço.`,
                    variant: "destructive",
                });
                setCreating(false);
                return;
            }

            // 2. Criação do Mercado
            const { error } = await supabase
                .from("markets")
                .insert({
                    name: name.trim(),
                    latitude: selectedLocation.lat,
                    longitude: selectedLocation.lng,
                    address: addressToSave,
                });

            if (error) throw error;

            toast({
                title: "Sucesso",
                description: "Mercado cadastrado com sucesso",
            });

            if (returnTo) {
                navigate(returnTo);
            } else {
                navigate("/mercados");
            }
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

    if (authLoading) return null;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header Fixo */}
            <header className="flex items-center gap-3 px-4 py-4 bg-background/95 backdrop-blur-md border-b border-border sticky top-0 z-40">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-xl font-display font-bold">Novo Mercado</h1>
            </header>

            {/* Conteúdo Principal */}
            <div className="flex-1 flex flex-col relative">
                {/* Input de Nome */}
                <div className="p-4 bg-background z-10">
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        Nome do estabelecimento
                    </label>
                    <Input
                        placeholder="Ex: Supermercado Preço Bom"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-14 rounded-xl text-lg shadow-sm"
                        autoFocus
                    />
                </div>

                {/* Mapa */}
                <div className="flex-1 relative min-h-[300px] bg-muted/20">
                    <MapSelector
                        onLocationSelect={(lat, lng) => setSelectedLocation({ lat, lng })}
                        selectedLocation={selectedLocation}
                        className="absolute inset-0 w-full h-full"
                    />

                    {!selectedLocation && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-border/50 pointer-events-none z-10">
                            <p className="text-xs font-medium text-foreground flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-primary" />
                                Toque no mapa para marcar
                            </p>
                        </div>
                    )}
                </div>

                {/* Painel Inferior */}
                <div className="bg-background border-t border-border p-4 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
                    {selectedLocation && (
                        <div className="mb-4 p-3 bg-secondary/30 rounded-xl border border-border/50">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    {fetchingAddress ? (
                                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                    ) : (
                                        <MapPin className="w-4 h-4 text-primary" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                                        Endereço Selecionado
                                    </p>
                                    <p className="text-sm font-medium text-foreground break-words leading-snug">
                                        {fetchingAddress
                                            ? "Buscando endereço..."
                                            : fetchedAddress || `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <Button
                        onClick={handleCreate}
                        className="w-full h-14 rounded-xl text-lg font-medium shadow-lg shadow-primary/20"
                        size="lg"
                        disabled={!name.trim() || !selectedLocation || creating}
                    >
                        {creating ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <>
                                <Save className="w-5 h-5 mr-2" />
                                Salvar Mercado
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
// src/pages/MarketDetail.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Loader2, Pencil, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MapSelector } from "@/components/MapSelector"; // <-- Importação nova
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Market {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
}

export default function MarketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getMarket();
  }, [id]);

  async function getMarket() {
    try {
      if (!id) return;
      const { data, error } = await supabase
        .from("markets")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setMarket(data);
    } catch (error) {
      console.error("Error fetching market:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os detalhes do mercado",
        variant: "destructive",
      });
      navigate("/mercados");
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("markets")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Mercado removido com sucesso",
      });
      navigate("/mercados");
    } catch (error) {
      console.error("Error deleting market:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o mercado. Verifique se existem preços associados a ele.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const openInMaps = () => {
    if (!market) return;
    // Abre no app de mapas nativo do celular ou Google Maps web
    window.open(`https://www.google.com/maps/search/?api=1&query=${market.latitude},${market.longitude}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!market) return null;

  return (
    <div className="min-h-screen bg-background pb-safe">
      <header className="flex items-center justify-between px-4 py-4 bg-background/95 backdrop-blur-md border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-display font-bold truncate max-w-[200px]">
            Detalhes
          </h1>
        </div>

        <div className="flex gap-2">
          {/* Botão de Editar (Placeholder por enquanto) */}
          <Button variant="ghost" size="icon" disabled>
            <Pencil className="w-5 h-5 text-muted-foreground" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="w-5 h-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="w-[90%] rounded-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir mercado?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso excluirá permanentemente o mercado
                  <span className="font-semibold text-foreground"> {market.name} </span>
                  do banco de dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleting}
                >
                  {deleting ? "Excluindo..." : "Sim, excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Mapa Estático */}
        <div className="h-56 rounded-2xl overflow-hidden shadow-sm border border-border relative group">
          <MapSelector
            selectedLocation={{ lat: market.latitude, lng: market.longitude }}
            readOnly={true} // Modo leitura
            className="w-full h-full"
          />

          {/* Botão flutuante para abrir no app de mapas */}
          <Button
            size="sm"
            className="absolute bottom-3 right-3 shadow-lg gap-2 z-[400]"
            onClick={openInMaps}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir GPS
          </Button>
        </div>

        {/* Informações */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">{market.name}</h2>
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
              <p className="text-sm leading-snug">
                {market.address || "Endereço não informado"}
              </p>
            </div>
          </div>

          {/* Aqui você pode adicionar estatísticas futuras, como "X produtos cadastrados" */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/30 p-4 rounded-xl border border-border/50">
              <p className="text-xs text-muted-foreground font-medium mb-1">Cadastrado em</p>
              <p className="text-sm font-semibold">Hoje</p> {/* Placeholder, pode formatar created_at se tiver */}
            </div>
            <div className="bg-secondary/30 p-4 rounded-xl border border-border/50">
              <p className="text-xs text-muted-foreground font-medium mb-1">Status</p>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-medium">
                Ativo
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
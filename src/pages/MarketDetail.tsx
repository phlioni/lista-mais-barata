import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Loader2,
  Pencil,
  Trash2,
  ExternalLink,
  Crown,
  Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MapSelector } from "@/components/MapSelector";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
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
  created_at: string;
  created_by: string;
}

interface Sovereign {
  user_id: string;
  score: number;
  display_name: string;
  avatar_url: string | null;
}

export default function MarketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [market, setMarket] = useState<Market | null>(null);
  const [sovereign, setSovereign] = useState<Sovereign | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id && user) {
      Promise.all([getMarket(), getSovereignData()]).finally(() => setLoading(false));
    }
  }, [id, user]);

  async function getMarket() {
    try {
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
    }
  }

  async function getSovereignData() {
    try {
      // 1. Buscar o Soberano (Maior Pontuação)
      const { data: scoreData, error } = await supabase
        .from("market_scores")
        .select(`
            score, 
            user_id, 
            profiles (display_name, avatar_url)
        `)
        .eq("market_id", id)
        .order("score", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (scoreData) {
        setSovereign({
          user_id: scoreData.user_id,
          score: scoreData.score,
          // @ts-ignore
          display_name: scoreData.profiles?.display_name || "Usuário",
          // @ts-ignore
          avatar_url: scoreData.profiles?.avatar_url,
        });
      }

      // 2. Buscar Meus Pontos neste mercado
      const { data: myData } = await supabase
        .from("market_scores")
        .select("score")
        .eq("market_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (myData) setMyScore(myData.score);

    } catch (error) {
      console.error("Error fetching sovereign data:", error);
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
        description: "Não foi possível remover o mercado.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const openInMaps = () => {
    if (!market) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${market.latitude},${market.longitude}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!market) return null;

  const isSovereign = sovereign?.user_id === user?.id;
  const pointsToBeat = sovereign ? (sovereign.score - myScore + 1) : 0;
  const isCreator = market.created_by === user?.id;

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
          {isCreator && (
            <Button variant="ghost" size="icon" disabled>
              <Pencil className="w-5 h-5 text-muted-foreground" />
            </Button>
          )}

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
                  Esta ação não pode ser desfeita.
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

        {/* --- CARD DO SOBERANO --- */}
        <div className={cn(
          "rounded-2xl p-5 border relative overflow-hidden shadow-sm transition-all",
          isSovereign
            ? "bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200"
            : sovereign
              ? "bg-white border-gray-200"
              : "bg-gray-100 border-dashed border-gray-300"
        )}>
          {isSovereign ? (
            <div className="flex items-center gap-4 relative z-10">
              <div className="bg-yellow-100 p-3 rounded-full border-4 border-white shadow-sm">
                <Crown className="w-8 h-8 text-yellow-600 fill-yellow-600 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-yellow-900 text-lg">Você é o Soberano! 👑</h3>
                <p className="text-yellow-700 text-sm">Seu território é inquestionável.</p>
                <span className="text-xs font-bold bg-white/50 px-2 py-0.5 rounded text-yellow-800 mt-1 inline-block">Score: {myScore}</span>
              </div>
            </div>
          ) : sovereign ? (
            <div className="flex items-center gap-4 relative z-10">
              <Avatar className="w-16 h-16 border-4 border-gray-100 shadow-sm">
                <AvatarImage src={sovereign.avatar_url || undefined} />
                <AvatarFallback>{sovereign.display_name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-base">Território de {sovereign.display_name}</h3>
                <p className="text-gray-500 text-xs mt-0.5">O atual Soberano domina com {sovereign.score} pontos.</p>

                {/* Barra de progresso para destronar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-medium">
                    <span>Você: {myScore}</span>
                    <span className="text-red-500">Faltam {pointsToBeat} pts</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((myScore / sovereign.score) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-gray-500">
              <div className="bg-gray-200 p-3 rounded-full">
                <Trophy className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-700">Território sem dono!</h3>
                <p className="text-xs">Seja o primeiro a atualizar preços aqui e torne-se o Soberano.</p>
              </div>
            </div>
          )}
        </div>
        {/* -------------------------------------- */}

        <div className="h-56 rounded-2xl overflow-hidden shadow-sm border border-border relative group">
          <MapSelector
            selectedLocation={{ lat: market.latitude, lng: market.longitude }}
            readOnly={true}
            className="w-full h-full"
          />

          <Button
            size="sm"
            className="absolute bottom-3 right-3 shadow-lg gap-2 z-[400]"
            onClick={openInMaps}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir GPS
          </Button>
        </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/30 p-4 rounded-xl border border-border/50">
              <p className="text-xs text-muted-foreground font-medium mb-1">Cadastrado em</p>
              <p className="text-sm font-semibold">
                {new Date(market.created_at).toLocaleDateString()}
              </p>
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
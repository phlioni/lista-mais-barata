import { MapPin, Navigation, Star, AlertCircle, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface MarketCardProps {
  id: string;
  listId: string;
  name: string;
  address: string | null;
  totalPrice: number;
  distance: number;
  missingItems: number;
  substitutedItems?: number; // Novo campo opcional
  rank: number;
  isRecommended: boolean;
  lastUpdate: string;
}

export function MarketCard({
  id,
  listId,
  name,
  address,
  totalPrice,
  distance,
  missingItems,
  substitutedItems = 0,
  rank,
  isRecommended,
  lastUpdate
}: MarketCardProps) {
  const navigate = useNavigate();

  // Função para navegar usando a rota que funciona no seu projeto
  const handleViewDetails = () => {
    navigate(`/mercado/${id}/${listId}?distance=${distance}&total=${totalPrice}`);
  };

  // Formata a data para dd/mm/aaaa
  const formattedDate = new Date(lastUpdate).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  return (
    <div className={cn(
      "relative bg-card rounded-2xl border transition-all duration-300 overflow-hidden",
      isRecommended
        ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20"
        : "border-border shadow-soft hover:shadow-md"
    )}>
      {isRecommended && (
        <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 rounded-bl-xl text-xs font-bold flex items-center gap-1 z-10">
          <Star className="w-3 h-3 fill-current" />
          Recomendado
        </div>
      )}

      <div className="p-4">
        {/* Header com Rank e Nome */}
        <div className="flex items-start gap-4 mb-3">
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0",
            rank === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            #{rank}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-lg truncate pr-20">{name}</h3>
            {address && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Preço e Distância */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground mb-0.5">Total estimado</p>
            <p className="text-2xl font-bold text-primary tracking-tight">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(totalPrice)}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-sm font-medium text-foreground">
              <Navigation className="w-3 h-3" />
              {distance < 1
                ? `${(distance * 1000).toFixed(0)}m`
                : `${distance.toFixed(1)}km`}
            </div>
            <p className="text-xs text-muted-foreground">de distância</p>
          </div>
        </div>

        {/* ÁREA DE ALERTAS INTELIGENTES */}
        <div className="space-y-2 mb-4">

          {/* Alerta de Substituição Inteligente (Novidade) */}
          {substitutedItems > 0 && (
            <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-2 rounded-lg text-xs font-medium">
              <Sparkles className="w-4 h-4 shrink-0 fill-indigo-200" />
              {substitutedItems} {substitutedItems === 1 ? "item otimizado" : "itens otimizados"} com marcas mais baratas
            </div>
          )}

          {/* Alertas de Itens Faltantes */}
          {missingItems > 0 && (
            <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-2 rounded-lg text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {missingItems} {missingItems === 1 ? "produto indisponível" : "produtos indisponíveis"}
            </div>
          )}
        </div>

        {/* Footer com Data e Ação */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50">
          {/* Data da atualização */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70" title="Última atualização de preço">
            <Clock className="w-3 h-3" />
            <span>Atualizado em {formattedDate}</span>
          </div>

          {/* Botão usando onClick para garantir a navegação correta */}
          <Button
            onClick={handleViewDetails}
            size="sm"
            className="h-9 px-4 rounded-xl font-medium"
          >
            Ver Detalhes
          </Button>
        </div>
      </div>
    </div>
  );
}
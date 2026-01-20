import { MapPin, Navigation, Star, AlertCircle, Clock, Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface MarketCardProps {
  id: string;
  listId?: string; // Agora opcional, pois pode ser usado na lista geral
  name: string;
  address: string | null;
  totalPrice?: number;
  distance?: number;
  missingItems?: number;
  substitutedItems?: number;
  rank?: number;
  isRecommended?: boolean;
  lastUpdate?: string;
  strategy?: 'cheapest' | 'best_brands';
  isOwner?: boolean; // <--- NOVA PROP
}

export function MarketCard({
  id,
  listId,
  name,
  address,
  totalPrice,
  distance,
  missingItems = 0,
  substitutedItems = 0,
  rank,
  isRecommended,
  lastUpdate,
  strategy = 'cheapest',
  isOwner = false // Padrão false
}: MarketCardProps) {
  const navigate = useNavigate();

  const handleViewDetails = () => {
    if (listId) {
      navigate(`/lista/${listId}?marketId=${id}&usePrices=true&strategy=${strategy}`);
    } else {
      navigate(`/ver-mercado/${id}`);
    }
  };

  const formattedDate = lastUpdate ? new Date(lastUpdate).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }) : null;

  return (
    <div className={cn(
      "relative bg-card rounded-2xl border transition-all duration-300 overflow-hidden",
      isRecommended
        ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20"
        : "border-border shadow-soft hover:shadow-md",
      isOwner && "border-yellow-300 shadow-yellow-100 ring-1 ring-yellow-200" // Destaque visual para o dono
    )}>

      {/* BADGE DE DONO */}
      {isOwner && (
        <div className="absolute top-0 left-0 bg-yellow-400 text-yellow-950 px-3 py-1 rounded-br-xl text-[10px] font-bold flex items-center gap-1 z-10 shadow-sm">
          <Crown className="w-3 h-3 fill-current" />
          SEU TERRITÓRIO
        </div>
      )}

      {isRecommended && (
        <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 rounded-bl-xl text-xs font-bold flex items-center gap-1 z-10">
          <Star className="w-3 h-3 fill-current" />
          Recomendado
        </div>
      )}

      <div className={cn("p-4", isOwner && "pt-8")}>
        <div className="flex items-start gap-4 mb-3">
          {rank && (
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0",
              rank === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              #{rank}
            </div>
          )}

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

        {totalPrice !== undefined && (
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
            {distance !== undefined && (
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-sm font-medium text-foreground">
                  <Navigation className="w-3 h-3" />
                  {distance < 1
                    ? `${(distance * 1000).toFixed(0)}m`
                    : `${distance.toFixed(1)}km`}
                </div>
                <p className="text-xs text-muted-foreground">de distância</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 mb-4">
          {substitutedItems > 0 && (
            <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-2 rounded-lg text-xs font-medium">
              <Sparkles className="w-4 h-4 shrink-0 fill-indigo-200" />
              {substitutedItems} {substitutedItems === 1 ? "item otimizado" : "itens otimizados"}
              {strategy === 'cheapest' ? ' (menor preço)' : ' (melhor marca)'}
            </div>
          )}

          {missingItems > 0 && (
            <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-2 rounded-lg text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {missingItems} {missingItems === 1 ? "produto indisponível" : "produtos indisponíveis"}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50">
          {formattedDate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70" title="Última atualização de preço">
              <Clock className="w-3 h-3" />
              <span>Atualizado em {formattedDate}</span>
            </div>
          )}

          <Button
            onClick={handleViewDetails}
            size="sm"
            className="h-9 px-4 rounded-xl font-medium ml-auto"
          >
            {listId ? "Ver Detalhes" : "Ver Perfil"}
          </Button>
        </div>
      </div>
    </div>
  );
}
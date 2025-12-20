import { MapPin, DollarSign, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface MarketCardProps {
  id: string;
  listId: string;
  name: string;
  totalPrice: number;
  distance: number;
  missingItems: number;
  rank?: number;
}

export function MarketCard({ 
  id, 
  listId, 
  name, 
  totalPrice, 
  distance, 
  missingItems,
  rank 
}: MarketCardProps) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    navigate(`/mercado/${id}/${listId}?distance=${distance}&total=${totalPrice}`);
  };
  
  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full bg-card rounded-2xl border border-border shadow-soft overflow-hidden",
        "transition-all duration-200 animate-slide-up text-left",
        "hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {rank && (
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0",
                rank === 1 ? "bg-primary text-primary-foreground" :
                rank === 2 ? "bg-secondary text-secondary-foreground" :
                "bg-muted text-muted-foreground"
              )}>
                {rank}º
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{name}</h3>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{distance.toFixed(1)} km</span>
                </div>
                {missingItems > 0 && (
                  <div className="flex items-center gap-1 text-sm text-warning">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{missingItems}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="flex items-center gap-1 text-primary font-bold text-lg">
                <span>R$ {totalPrice.toFixed(2)}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </div>
    </button>
  );
}

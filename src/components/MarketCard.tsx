import { MapPin, DollarSign, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface MarketCardProps {
  name: string;
  totalPrice: number;
  distance: number;
  missingItems: number;
  products?: Array<{ name: string; price: number | null }>;
}

export function MarketCard({ name, totalPrice, distance, missingItems, products }: MarketCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div 
      className={cn(
        "bg-card rounded-2xl border border-border shadow-soft overflow-hidden",
        "transition-all duration-200 animate-slide-up"
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">{name}</h3>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{distance.toFixed(1)} km</span>
              </div>
              {missingItems > 0 && (
                <div className="flex items-center gap-1 text-sm text-warning">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{missingItems} {missingItems === 1 ? "item indisponível" : "itens indisponíveis"}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-1 text-primary font-bold text-lg">
              <DollarSign className="w-5 h-5" />
              <span>R$ {totalPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </button>
      
      {isExpanded && products && (
        <div className="px-4 pb-4 border-t border-border pt-3 animate-fade-in">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Preços dos itens:</p>
          <div className="space-y-2">
            {products.map((product, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className={product.price ? "text-foreground" : "text-muted-foreground line-through"}>
                  {product.name}
                </span>
                <span className={product.price ? "text-primary font-medium" : "text-muted-foreground"}>
                  {product.price ? `R$ ${product.price.toFixed(2)}` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

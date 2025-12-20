import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";

interface ProductItemProps {
  id: string;
  name: string;
  brand?: string;
  quantity: number;
  isChecked: boolean;
  price?: number;
  showPriceInput?: boolean;
  onToggleCheck: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdatePrice?: (id: string, price: number) => void;
  onRemove: (id: string) => void;
}

export function ProductItem({
  id,
  name,
  brand,
  quantity,
  isChecked,
  price,
  showPriceInput = false,
  onToggleCheck,
  onUpdateQuantity,
  onUpdatePrice,
  onRemove,
}: ProductItemProps) {
  return (
    <div className={cn(
      "flex flex-col gap-2 p-3 bg-card rounded-xl border border-border",
      "transition-all duration-200",
      isChecked && "bg-muted/50 border-muted"
    )}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onToggleCheck(id)}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all duration-200 flex-shrink-0",
            isChecked 
              ? "bg-primary border-primary" 
              : "border-muted-foreground/30 hover:border-primary"
          )}
        >
          {isChecked && <Check className="w-4 h-4 text-primary-foreground" />}
        </button>
        
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-medium text-foreground transition-all duration-200",
            isChecked && "text-muted-foreground line-through"
          )}>
            {name}
          </p>
          {brand && (
            <p className="text-xs text-muted-foreground">{brand}</p>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onUpdateQuantity(id, Math.max(1, quantity - 1))}
          >
            <Minus className="w-4 h-4" />
          </Button>
          <span className="w-8 text-center font-medium text-foreground">{quantity}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onUpdateQuantity(id, quantity + 1)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
          onClick={() => onRemove(id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      
      {showPriceInput && (
        <div className="flex items-center gap-2 pl-9">
          <span className="text-sm text-muted-foreground">R$</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={price || ""}
            onChange={(e) => onUpdatePrice?.(id, parseFloat(e.target.value) || 0)}
            className="h-9 w-24 text-right"
          />
          {price && price > 0 && quantity > 1 && (
            <span className="text-xs text-muted-foreground">
              = R$ {(price * quantity).toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

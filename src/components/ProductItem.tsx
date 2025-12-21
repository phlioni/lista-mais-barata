import { Minus, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { memo } from "react";

interface ProductItemProps {
  id: string;
  name: string;
  brand?: string;
  quantity: number;
  isChecked: boolean;
  price?: number;
  showPriceInput?: boolean;
  readonly?: boolean;
  onToggleCheck: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdatePrice: (id: string, price: number) => void;
  onRemove: (id: string) => void;
}

export const ProductItem = memo(function ProductItem({
  id,
  name,
  brand,
  quantity,
  isChecked,
  price,
  showPriceInput,
  readonly = false,
  onToggleCheck,
  onUpdateQuantity,
  onUpdatePrice,
  onRemove,
}: ProductItemProps) {

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 p-4 rounded-xl border transition-all duration-200 bg-card",
        isChecked ? "border-transparent bg-muted/40" : "border-border/50 shadow-sm",
        readonly && "opacity-90 pointer-events-none" // Menor opacidade para indicar estado
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox Area */}
        <button
          onClick={() => !readonly && onToggleCheck(id)}
          disabled={readonly}
          className={cn(
            "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-200 flex-shrink-0",
            isChecked
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-muted-foreground/30 hover:border-primary/50",
            readonly && isChecked && "bg-muted-foreground border-transparent opacity-50"
          )}
        >
          {isChecked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </button>

        {/* Product Info */}
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className={cn(
            "font-medium leading-tight transition-all text-base",
            isChecked ? "text-muted-foreground line-through decoration-border/50" : "text-foreground"
          )}>
            {name}
          </h3>
          {brand && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{brand}</p>
          )}
        </div>

        {/* Remove Button (Only if not readonly) */}
        {!readonly && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(id)}
            className="h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-1"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Controls Area (Price & Quantity) */}
      <div className="flex items-center justify-between gap-3 pl-9">
        {/* Price Input (Only in Shopping Mode) or Static Price */}
        {showPriceInput ? (
          <div className="flex items-center gap-2 flex-1 max-w-[140px]">
            <span className="text-sm font-medium text-muted-foreground">R$</span>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0,00"
              value={price || ""}
              onChange={(e) => onUpdatePrice(id, parseFloat(e.target.value))}
              className="h-10 px-3 text-right font-medium tabular-nums rounded-lg bg-background/50 focus:bg-background"
              disabled={readonly}
            />
          </div>
        ) : (
          <div className="text-sm font-semibold text-primary">
            {price && price > 0 ? `R$ ${price.toFixed(2)}` : ""}
          </div>
        )}

        {/* Quantity Controls */}
        <div className={cn(
          "flex items-center rounded-lg p-0.5 border border-transparent transition-colors ml-auto",
          !readonly ? "bg-secondary/50 hover:border-border/50" : ""
        )}>
          {!readonly ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onUpdateQuantity(id, Math.max(1, quantity - 1))}
                className="h-8 w-8 rounded-md hover:bg-background shadow-sm"
                disabled={quantity <= 1}
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <span className="w-8 text-center text-sm font-medium tabular-nums">
                {quantity}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onUpdateQuantity(id, quantity + 1)}
                className="h-8 w-8 rounded-md hover:bg-background shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground bg-muted/50 rounded-md">
              Qtd: {quantity}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
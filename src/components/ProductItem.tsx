import { Minus, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

export function ProductItem({
  id,
  name,
  brand,
  quantity,
  isChecked,
  price,
  showPriceInput = false,
  readonly = false,
  onToggleCheck,
  onUpdateQuantity,
  onUpdatePrice,
  onRemove,
}: ProductItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200",
        isChecked
          ? "bg-muted/50 border-transparent opacity-75"
          : "bg-card border-border shadow-sm hover:border-primary/20 hover:shadow-md"
      )}
    >
      {/* Checkbox */}
      {!readonly && (
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => onToggleCheck(id)}
          className="w-5 h-5 rounded-md border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-colors flex-shrink-0"
        />
      )}

      {/* Informações de Texto */}
      <div className={cn("flex-1 min-w-0", readonly && "pl-1")}>
        <p
          className={cn(
            "font-medium text-sm leading-tight truncate transition-all",
            isChecked ? "text-muted-foreground line-through decoration-border" : "text-foreground"
          )}
        >
          {name}
        </p>
        {brand && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5 font-medium">
            {brand}
          </p>
        )}
      </div>

      {/* Controles e Preço */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Input de Preço (Modo Compras) */}
        {showPriceInput && (
          <div className="relative w-[85px]">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
              R$
            </span>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0,00"
              value={price || ""}
              onChange={(e) => onUpdatePrice(id, parseFloat(e.target.value))}
              className="h-8 pl-7 pr-2 text-sm text-right font-medium bg-background/50 border-input shadow-none focus-visible:ring-1 focus-visible:bg-background"
            />
          </div>
        )}

        {/* Exibição de Preço (Modo Leitura/Comparação) */}
        {!showPriceInput && price !== undefined && price > 0 && (
          <div className="text-right px-1">
            <p className="text-sm font-bold text-emerald-600">
              R$ {(price * quantity).toFixed(2)}
            </p>
            {quantity > 1 && (
              <p className="text-[10px] text-muted-foreground">
                {quantity}x R$ {price.toFixed(2)}
              </p>
            )}
          </div>
        )}

        {/* Controles de Quantidade */}
        {!readonly && (
          <div className="flex items-center bg-secondary/30 rounded-lg border border-border/50 h-8">
            <button
              onClick={() => quantity > 1 && onUpdateQuantity(id, quantity - 1)}
              disabled={quantity <= 1}
              className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 active:scale-90 transition-all"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-6 text-center text-xs font-semibold tabular-nums">
              {quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(id, quantity + 1)}
              className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-90 transition-all"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Quantidade (Modo Leitura) */}
        {readonly && !showPriceInput && !price && (
          <span className="text-xs font-medium bg-secondary px-2 py-1 rounded-md text-muted-foreground">
            {quantity}un
          </span>
        )}

        {/* Botão Excluir */}
        {!readonly && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(id)}
            className="h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 -mr-1"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ProductItemProps {
  id: string;
  name: string;
  brand?: string | null;
  measurement?: string | null;
  quantity: number;
  isChecked: boolean;
  price?: number;
  showPriceInput?: boolean;
  readonly?: boolean;
  isSimpleMode?: boolean; // Novo modo simplificado
  onToggleCheck: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdatePrice: (id: string, price: number) => void;
  onUpdateBrand?: (id: string, brand: string) => void; // Edição de marca
  onRemove: (id: string) => void;
}

export function ProductItem({
  id,
  name,
  brand,
  measurement,
  quantity,
  isChecked,
  price,
  showPriceInput = false,
  readonly = false,
  isSimpleMode = false,
  onToggleCheck,
  onUpdateQuantity,
  onUpdatePrice,
  onUpdateBrand,
  onRemove,
}: ProductItemProps) {

  const formatCurrencyValue = (value: number | undefined) => {
    if (value === undefined) return "";
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handlePriceChange = (rawValue: string) => {
    const onlyDigits = rawValue.replace(/\D/g, "");
    if (onlyDigits === "") {
      onUpdatePrice(id, 0);
      return;
    }
    const floatValue = Number(onlyDigits) / 100;
    onUpdatePrice(id, floatValue);
  };

  return (
    <div
      className={cn(
        "group p-3 rounded-xl border transition-all duration-200",
        "flex flex-col sm:flex-row sm:items-center gap-3",
        isChecked
          ? "bg-muted/50 border-transparent opacity-75"
          : "bg-card border-border shadow-sm hover:border-primary/20 hover:shadow-md"
      )}
    >
      {/* SEÇÃO SUPERIOR: Checkbox e Dados Principais */}
      <div className="flex items-start gap-3 w-full">
        {/* Checkbox: Oculto no modo simples */}
        {!readonly && !isSimpleMode && (
          <Checkbox
            checked={isChecked}
            onCheckedChange={() => onToggleCheck(id)}
            className="mt-1 w-5 h-5 rounded-md border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-colors flex-shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "font-medium text-sm leading-snug transition-all break-words",
              "line-clamp-2 sm:line-clamp-1",
              isChecked ? "text-muted-foreground line-through decoration-border" : "text-foreground"
            )}
          >
            {name}
          </p>

          {/* Linha de Marca e Medida: Oculta no modo simples */}
          {!isSimpleMode && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Se estiver no modo de compras (showPriceInput), mostra Input para Marca */}
              {showPriceInput && onUpdateBrand ? (
                <Input
                  value={brand || ""}
                  onChange={(e) => onUpdateBrand(id, e.target.value)}
                  placeholder="Marca"
                  className="h-6 w-28 text-[11px] px-2 py-0 bg-secondary/50 border-transparent focus:bg-background focus:border-primary rounded-md"
                />
              ) : (
                brand && (
                  <p className="text-[11px] text-muted-foreground truncate font-medium">
                    {brand}
                  </p>
                )
              )}

              {measurement && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-primary/80 border border-border/50">
                  {measurement}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SEÇÃO INFERIOR: Controles (Preço, Quantidade, Lixeira) */}
      <div className={cn(
        "flex items-center gap-2",
        "justify-end w-full pl-8 sm:pl-0 sm:w-auto sm:justify-start"
      )}>

        {/* Input de Preço: Apenas no modo compras */}
        {showPriceInput && !isSimpleMode && (
          <div className="relative w-[100px] sm:w-[95px]">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
              R$
            </span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={formatCurrencyValue(price)}
              onChange={(e) => handlePriceChange(e.target.value)}
              className="h-9 sm:h-8 pl-8 pr-2 text-sm text-right font-medium bg-background/50 border-input shadow-none focus-visible:ring-1 focus-visible:bg-background"
            />
          </div>
        )}

        {/* Exibição de Preço Total (para itens já com preço ou modo leitura) */}
        {!showPriceInput && price !== undefined && price > 0 && !isSimpleMode && (
          <div className="text-right px-1">
            <p className="text-sm font-bold text-emerald-600 whitespace-nowrap">
              R$ {(price * quantity).toFixed(2).replace('.', ',')}
            </p>
            {quantity > 1 && (
              <p className="text-[10px] text-muted-foreground">
                {quantity}x R$ {price.toFixed(2).replace('.', ',')}
              </p>
            )}
          </div>
        )}

        {/* Controles de Quantidade: Ocultos no modo simples */}
        {!readonly && !isSimpleMode && (
          <div className="flex items-center bg-secondary/30 rounded-lg border border-border/50 h-9 sm:h-8">
            <button
              onClick={() => quantity > 1 && onUpdateQuantity(id, quantity - 1)}
              disabled={quantity <= 1}
              className="w-9 sm:w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 active:scale-90 transition-all"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="min-w-[1.5rem] px-1 text-center text-xs font-semibold tabular-nums">
              {quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(id, quantity + 1)}
              className="w-9 sm:w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-90 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quantidade estática (badge) para modo leitura */}
        {readonly && !showPriceInput && (!price || price <= 0) && (
          <span className="text-xs font-medium bg-secondary px-2 py-1 rounded-md text-muted-foreground whitespace-nowrap">
            {quantity} un
          </span>
        )}

        {/* Lixeira: Sempre visível (se não for readonly) */}
        {!readonly && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(id)}
            className="h-9 w-9 sm:h-8 sm:w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 sm:-mr-1"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
// src/components/MarketSelector.tsx
import { useState, useEffect } from "react";
import { Check, MapPin, Search, Store, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";

interface Market {
  id: string;
  name: string;
  address: string | null;
}

interface MarketSelectorProps {
  selectedMarket: Market | null;
  onSelectMarket: (market: Market) => void;
}

export function MarketSelector({ selectedMarket, onSelectMarket }: MarketSelectorProps) {
  const [open, setOpen] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Carrega os mercados apenas quando o modal é aberto para economizar recursos
  useEffect(() => {
    if (open && markets.length === 0) {
      fetchMarkets();
    }
  }, [open]);

  async function fetchMarkets() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("markets")
        .select("id, name, address")
        .order("name");

      if (data) setMarkets(data);
    } catch (error) {
      console.error("Error fetching markets:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredMarkets = markets.filter(market =>
    market.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (market.address && market.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelect = (market: Market) => {
    onSelectMarket(market);
    setOpen(false);
  };

  const handleCreateNew = () => {
    setOpen(false);
    // Salva a rota atual para retornar após o cadastro
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    navigate(`/mercados/novo?returnTo=${returnUrl}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-14 px-4 rounded-xl border-border bg-card hover:bg-accent/50 group"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <Store className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col items-start truncate">
              <span className="text-xs text-muted-foreground font-medium">Mercado selecionado</span>
              <span className="text-sm font-semibold truncate text-foreground">
                {selectedMarket ? selectedMarket.name : "Selecione um mercado..."}
              </span>
            </div>
          </div>
          <Search className="w-4 h-4 text-muted-foreground opacity-50 shrink-0" />
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[95%] max-w-md rounded-2xl p-0 gap-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 border-b border-border/50">
          <DialogTitle>Escolha o Mercado</DialogTitle>
        </DialogHeader>

        <div className="p-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou endereço..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 rounded-xl bg-secondary/30 border-transparent focus:bg-background focus:border-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[40vh] p-4 pt-0">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando mercados...</div>
          ) : filteredMarkets.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Nenhum mercado encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMarkets.map((market) => (
                <button
                  key={market.id}
                  onClick={() => handleSelect(market)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all border",
                    selectedMarket?.id === market.id
                      ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                      : "bg-card border-border hover:border-primary/30 hover:bg-accent/50"
                  )}
                >
                  <MapPin className={cn(
                    "w-5 h-5 mt-0.5 flex-shrink-0",
                    selectedMarket?.id === market.id ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium leading-none mb-1.5",
                      selectedMarket?.id === market.id ? "text-primary" : "text-foreground"
                    )}>
                      {market.name}
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                      {market.address || "Endereço não cadastrado"}
                    </p>
                  </div>
                  {selectedMarket?.id === market.id && (
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Rodapé fixo com o botão de criar */}
        <div className="p-4 border-t border-border bg-background z-10">
          <Button
            variant="secondary"
            className="w-full gap-2 h-12 rounded-xl border border-border/50 shadow-sm"
            onClick={handleCreateNew}
          >
            <Plus className="w-4 h-4" />
            Cadastrar novo mercado
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
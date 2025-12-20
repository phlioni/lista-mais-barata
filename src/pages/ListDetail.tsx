import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Search, Scale, Loader2, X, ShoppingCart, Check, Store, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductItem } from "@/components/ProductItem";
import { EmptyState } from "@/components/EmptyState";
import { BottomNav } from "@/components/BottomNav";
import { MarketSelector } from "@/components/MarketSelector";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  brand: string | null;
}

interface ListItem {
  id: string;
  product_id: string;
  quantity: number;
  is_checked: boolean;
  products: Product;
}

interface ShoppingList {
  id: string;
  name: string;
  status: string;
}

interface Market {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
}

interface ItemPrice {
  [itemId: string]: number;
}

export default function ListDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [addingProducts, setAddingProducts] = useState(false);
  
  // Shopping mode state
  const [isShoppingMode, setIsShoppingMode] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [itemPrices, setItemPrices] = useState<ItemPrice>({});
  const [saving, setSaving] = useState(false);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchListData();
      fetchProducts();
    }
  }, [user, id]);

  const fetchListData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const { data: listData, error: listError } = await supabase
        .from("shopping_lists")
        .select("*")
        .eq("id", id)
        .single();

      if (listError) throw listError;
      setList(listData);

      const { data: itemsData, error: itemsError } = await supabase
        .from("list_items")
        .select(`
          id,
          product_id,
          quantity,
          is_checked,
          products (id, name, brand)
        `)
        .eq("list_id", id);

      if (itemsError) throw itemsError;
      setItems(itemsData as ListItem[]);
    } catch (error) {
      console.error("Error fetching list:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, brand")
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const toggleProductSelection = (productId: string) => {
    const existingItem = items.find((item) => item.product_id === productId);
    if (existingItem) return; // Already in list

    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const addSelectedProducts = async () => {
    if (!id || selectedProducts.size === 0) return;

    setAddingProducts(true);
    try {
      const productsToAdd = Array.from(selectedProducts);
      const insertData = productsToAdd.map((productId) => ({
        list_id: id,
        product_id: productId,
        quantity: 1,
        is_checked: false,
      }));

      const { data, error } = await supabase
        .from("list_items")
        .insert(insertData)
        .select(`
          id,
          product_id,
          quantity,
          is_checked,
          products (id, name, brand)
        `);

      if (error) throw error;

      setItems([...items, ...(data as ListItem[])]);
      setSelectedProducts(new Set());
      setAddDialogOpen(false);
      setSearchQuery("");

      toast({
        title: "Itens adicionados",
        description: `${data.length} ${data.length === 1 ? "produto adicionado" : "produtos adicionados"} à lista`,
      });
    } catch (error) {
      console.error("Error adding products:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar os itens",
        variant: "destructive",
      });
    } finally {
      setAddingProducts(false);
    }
  };

  const closeAddDialog = (open: boolean) => {
    if (!open) {
      setSelectedProducts(new Set());
      setSearchQuery("");
    }
    setAddDialogOpen(open);
  };

  const toggleCheck = async (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    try {
      const { error } = await supabase
        .from("list_items")
        .update({ is_checked: !item.is_checked })
        .eq("id", itemId);

      if (error) throw error;
      
      setItems(items.map((i) => 
        i.id === itemId ? { ...i, is_checked: !i.is_checked } : i
      ));
    } catch (error) {
      console.error("Error toggling check:", error);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      const { error } = await supabase
        .from("list_items")
        .update({ quantity })
        .eq("id", itemId);

      if (error) throw error;
      
      setItems(items.map((i) => 
        i.id === itemId ? { ...i, quantity } : i
      ));
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  const updatePrice = (itemId: string, price: number) => {
    setItemPrices((prev) => ({
      ...prev,
      [itemId]: price,
    }));
  };

  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("list_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      
      setItems(items.filter((i) => i.id !== itemId));
      toast({
        title: "Item removido",
      });
    } catch (error) {
      console.error("Error removing item:", error);
    }
  };

  const startShopping = () => {
    if (!selectedMarket) {
      toast({
        title: "Selecione um mercado",
        description: "Escolha ou cadastre o mercado onde você está fazendo compras",
        variant: "destructive",
      });
      return;
    }
    setIsShoppingMode(true);
    // Reset all checks
    items.forEach((item) => {
      if (item.is_checked) {
        toggleCheck(item.id);
      }
    });
  };

  const cancelShopping = () => {
    setIsShoppingMode(false);
    setItemPrices({});
  };

  const finishShopping = async () => {
    if (!selectedMarket || !id) return;

    const itemsWithPrices = items.filter(
      (item) => itemPrices[item.id] && itemPrices[item.id] > 0
    );

    if (itemsWithPrices.length === 0) {
      toast({
        title: "Nenhum preço informado",
        description: "Informe o preço de pelo menos um produto",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Prepare price records
      const priceRecords = itemsWithPrices.map((item) => ({
        market_id: selectedMarket.id,
        product_id: item.product_id,
        price: itemPrices[item.id],
      }));

      // Upsert prices (update if exists, insert if not)
      for (const record of priceRecords) {
        // Check if price exists for this market + product
        const { data: existing } = await supabase
          .from("market_prices")
          .select("id")
          .eq("market_id", record.market_id)
          .eq("product_id", record.product_id)
          .maybeSingle();

        if (existing) {
          // Update existing price
          await supabase
            .from("market_prices")
            .update({ price: record.price, created_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          // Insert new price
          await supabase
            .from("market_prices")
            .insert(record);
        }
      }

      // Close the list
      await supabase
        .from("shopping_lists")
        .update({ status: "closed" })
        .eq("id", id);

      toast({
        title: "Compras finalizadas!",
        description: `${itemsWithPrices.length} preços salvos em ${selectedMarket.name}`,
      });

      setFinishDialogOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Error saving prices:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar os preços",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPrice = Object.entries(itemPrices).reduce((acc, [itemId, price]) => {
    const item = items.find((i) => i.id === itemId);
    return acc + (price * (item?.quantity || 1));
  }, 0);

  const checkedCount = items.filter((i) => i.is_checked).length;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Lista não encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-4 max-w-md mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-display font-bold text-foreground">{list.name}</h1>
            <p className="text-sm text-muted-foreground">
              {isShoppingMode 
                ? `${checkedCount}/${items.length} itens • R$ ${totalPrice.toFixed(2)}`
                : `${items.length} ${items.length === 1 ? "item" : "itens"}`
              }
            </p>
          </div>
          {!isShoppingMode && (
            <Button onClick={() => setAddDialogOpen(true)} size="icon" variant="ghost" className="text-primary">
              <Plus className="w-6 h-6" />
            </Button>
          )}
        </div>
        
        {/* Shopping mode indicator */}
        {isShoppingMode && selectedMarket && (
          <div className="px-4 pb-3 max-w-md mx-auto">
            <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg text-primary text-sm">
              <Store className="w-4 h-4" />
              <span className="font-medium">Comprando em: {selectedMarket.name}</span>
            </div>
          </div>
        )}
      </header>

      {/* Items */}
      <main className="px-4 py-4 max-w-md mx-auto">
        {/* Market selector (only when not in shopping mode) */}
        {!isShoppingMode && items.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">
              Onde você vai fazer as compras?
            </p>
            <MarketSelector
              selectedMarket={selectedMarket}
              onSelectMarket={setSelectedMarket}
            />
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState
            icon={<Plus className="w-8 h-8 text-primary" />}
            title="Lista vazia"
            description="Adicione produtos à sua lista para começar"
            action={
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-5 h-5" />
                Adicionar Produto
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <ProductItem
                key={item.id}
                id={item.id}
                name={item.products.name}
                brand={item.products.brand || undefined}
                quantity={item.quantity}
                isChecked={item.is_checked}
                price={itemPrices[item.id]}
                showPriceInput={isShoppingMode}
                onToggleCheck={toggleCheck}
                onUpdateQuantity={updateQuantity}
                onUpdatePrice={updatePrice}
                onRemove={removeItem}
              />
            ))}
          </div>
        )}
      </main>

      {/* Fixed bottom actions */}
      {items.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border">
          <div className="max-w-md mx-auto space-y-2">
            {!isShoppingMode ? (
              <>
                <Button
                  onClick={startShopping}
                  className="w-full h-14"
                  size="lg"
                  disabled={!selectedMarket}
                >
                  <ShoppingCart className="w-5 h-5" />
                  Iniciar Compras
                </Button>
                <Button
                  onClick={() => navigate(`/comparar/${id}`)}
                  variant="outline"
                  className="w-full h-12"
                >
                  <Scale className="w-5 h-5" />
                  Comparar Preços
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={cancelShopping}
                  variant="outline"
                  className="flex-1 h-14"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => setFinishDialogOpen(true)}
                  className="flex-1 h-14"
                >
                  <Check className="w-5 h-5" />
                  Finalizar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Product Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={closeAddDialog}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">
              Adicionar Produtos
              {selectedProducts.size > 0 && (
                <span className="ml-2 text-sm font-normal text-primary">
                  ({selectedProducts.size} selecionado{selectedProducts.size > 1 ? "s" : ""})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4 flex-1 overflow-hidden flex flex-col">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 rounded-xl"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1">
              {filteredProducts.map((product) => {
                const isInList = items.some((item) => item.product_id === product.id);
                const isSelected = selectedProducts.has(product.id);
                
                return (
                  <button
                    key={product.id}
                    onClick={() => toggleProductSelection(product.id)}
                    disabled={isInList}
                    className={cn(
                      "w-full p-3 text-left rounded-xl transition-colors flex items-center gap-3",
                      isInList 
                        ? "opacity-50 cursor-not-allowed bg-muted" 
                        : isSelected 
                          ? "bg-primary/10 border-2 border-primary" 
                          : "hover:bg-accent border-2 border-transparent"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-full border-2 flex-shrink-0 transition-all",
                      isInList 
                        ? "border-muted-foreground/30 bg-muted-foreground/10" 
                        : isSelected 
                          ? "border-primary bg-primary" 
                          : "border-muted-foreground/30"
                    )}>
                      {(isInList || isSelected) && (
                        <Check className={cn(
                          "w-4 h-4",
                          isInList ? "text-muted-foreground" : "text-primary-foreground"
                        )} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium",
                        isInList ? "text-muted-foreground" : "text-foreground"
                      )}>
                        {product.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {isInList ? "Já está na lista" : product.brand || ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          {selectedProducts.size > 0 && (
            <DialogFooter className="mt-4">
              <Button
                onClick={addSelectedProducts}
                className="w-full h-12"
                disabled={addingProducts}
              >
                {addingProducts ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Adicionar {selectedProducts.size} {selectedProducts.size === 1 ? "Produto" : "Produtos"}
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Finish Shopping Confirmation */}
      <AlertDialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <AlertDialogContent className="max-w-sm mx-4 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Finalizar Compras?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Os preços informados serão salvos para <strong>{selectedMarket?.name}</strong>.
              </p>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-lg font-bold text-foreground">
                  Total: R$ {totalPrice.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {Object.keys(itemPrices).filter((k) => itemPrices[k] > 0).length} produtos com preço
                </p>
              </div>
              <p className="text-sm">
                Isso irá atualizar o histórico de preços deste mercado para futuras comparações.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={finishShopping} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}

import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Search, Scale, Loader2, X, ShoppingCart,
  Check, Store, Copy, Lock, MoreVertical, Pencil, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductItem } from "@/components/ProductItem";
import { EmptyState } from "@/components/EmptyState";
import { AppMenu } from "@/components/AppMenu"; // Menu Lateral
import { MarketSelector } from "@/components/MarketSelector";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ... (Interfaces Product, ListItem, ShoppingList, Market, ItemPrice mantidas iguais)
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
  market_id?: string | null;
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const preselectedMarketId = searchParams.get("marketId");
  const usePrices = searchParams.get("usePrices") === "true";

  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);

  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [deleteListDialogOpen, setDeleteListDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [addingProducts, setAddingProducts] = useState(false);

  // Shopping mode state
  const [isShoppingMode, setIsShoppingMode] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [itemPrices, setItemPrices] = useState<ItemPrice>({});
  const [saving, setSaving] = useState(false);
  const [startingShopping, setStartingShopping] = useState(false);

  // Duplication state
  const [newListName, setNewListName] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      const init = async () => {
        setLoading(true);
        await Promise.all([fetchListData(), fetchProducts()]);
        setLoading(false);
      };
      init();
    }
  }, [user, id]);

  useEffect(() => {
    if (preselectedMarketId && usePrices && list && list.status === 'open') {
      loadMarketData(preselectedMarketId, true, true);
    }
  }, [preselectedMarketId, usePrices, list]);

  const fetchListData = async () => {
    if (!id) return;

    try {
      const { data: listData, error: listError } = await supabase
        .from("shopping_lists")
        .select("*")
        .eq("id", id)
        .single();

      if (listError) throw listError;
      setList(listData);
      setNewListName(`Cópia de ${listData.name}`);
      setEditingName(listData.name);

      const { data: itemsData, error: itemsError } = await supabase
        .from("list_items")
        .select(`
          id,
          product_id,
          quantity,
          is_checked,
          products (id, name, brand)
        `)
        .eq("list_id", id)
        .order("created_at");

      if (itemsError) throw itemsError;
      setItems(itemsData as ListItem[]);

      if (listData.market_id) {
        if (listData.status === 'closed') {
          await loadMarketData(listData.market_id, false, true);
        } else if (listData.status === 'shopping') {
          await loadMarketData(listData.market_id, true, false);
        }
      }

    } catch (error) {
      console.error("Error fetching list:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista",
        variant: "destructive",
      });
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

  const loadMarketData = async (
    marketId: string,
    enableShoppingMode: boolean = false,
    shouldFetchPrices: boolean = false
  ) => {
    try {
      const { data: marketData, error: marketError } = await supabase
        .from("markets")
        .select("*")
        .eq("id", marketId)
        .single();

      if (marketError) throw marketError;
      setSelectedMarket(marketData);

      if (shouldFetchPrices) {
        const { data: listItems } = await supabase
          .from("list_items")
          .select("id, product_id")
          .eq("list_id", id);

        if (listItems && listItems.length > 0) {
          const productIds = listItems.map((i: any) => i.product_id);

          const { data: pricesData } = await supabase
            .from("market_prices")
            .select("product_id, price")
            .eq("market_id", marketId)
            .in("product_id", productIds);

          if (pricesData) {
            const productToItem: { [productId: string]: string } = {};
            listItems.forEach((item: any) => {
              productToItem[item.product_id] = item.id;
            });

            const prices: ItemPrice = {};
            pricesData.forEach((price: any) => {
              const itemId = productToItem[price.product_id];
              if (itemId) {
                prices[itemId] = price.price;
              }
            });
            setItemPrices(prices);
          }
        }
      } else {
        setItemPrices({});
      }

      if (enableShoppingMode) {
        setIsShoppingMode(true);
      }

    } catch (error) {
      console.error("Error loading market data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    }
  };

  const updateListName = async () => {
    if (!id || !editingName.trim()) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("shopping_lists")
        .update({ name: editingName.trim() })
        .eq("id", id);

      if (error) throw error;

      setList((prev) => prev ? { ...prev, name: editingName.trim() } : null);
      setEditNameDialogOpen(false);
    } catch (error) {
      console.error("Error updating list name:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível mudar o nome da lista",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteList = async () => {
    if (!id) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("shopping_lists")
        .delete()
        .eq("id", id);

      if (error) throw error;

      navigate("/");
    } catch (error) {
      console.error("Error deleting list:", error);
      toast({
        title: "Erro ao excluir",
        description: "Tente novamente",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  const toggleProductSelection = (productId: string) => {
    const existingItem = items.find((item) => item.product_id === productId);
    if (existingItem) return;

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
    if (list?.status === 'closed') return;

    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const newCheckedState = !item.is_checked;
    setItems(items.map((i) =>
      i.id === itemId ? { ...i, is_checked: newCheckedState } : i
    ));

    try {
      const { error } = await supabase
        .from("list_items")
        .update({ is_checked: newCheckedState })
        .eq("id", itemId);

      if (error) {
        setItems(items.map((i) =>
          i.id === itemId ? { ...i, is_checked: !newCheckedState } : i
        ));
        throw error;
      }
    } catch (error) {
      console.error("Error toggling check:", error);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (list?.status === 'closed') return;

    setItems(items.map((i) =>
      i.id === itemId ? { ...i, quantity } : i
    ));

    try {
      const { error } = await supabase
        .from("list_items")
        .update({ quantity })
        .eq("id", itemId);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  const updatePrice = (itemId: string, price: number) => {
    if (list?.status === 'closed') return;
    setItemPrices((prev) => ({
      ...prev,
      [itemId]: price,
    }));
  };

  const removeItem = async (itemId: string) => {
    if (list?.status === 'closed') return;

    try {
      const { error } = await supabase
        .from("list_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      setItems(items.filter((i) => i.id !== itemId));
    } catch (error) {
      console.error("Error removing item:", error);
      toast({ title: "Erro ao remover item", variant: "destructive" });
    }
  };

  const startShopping = async () => {
    if (!selectedMarket || !id) {
      toast({
        title: "Selecione um mercado",
        description: "Escolha o mercado para iniciar as compras",
        variant: "destructive",
      });
      return;
    }

    setStartingShopping(true);
    try {
      const { error } = await supabase
        .from("shopping_lists")
        .update({
          status: 'shopping',
          market_id: selectedMarket.id
        })
        .eq("id", id);

      if (error) throw error;

      setList(prev => prev ? { ...prev, status: 'shopping', market_id: selectedMarket.id } : null);

      setIsShoppingMode(true);
      loadMarketData(selectedMarket.id, true, false);

      items.forEach((item) => {
        if (item.is_checked) {
          toggleCheck(item.id);
        }
      });
    } catch (error) {
      console.error("Error starting shopping:", error);
      toast({
        title: "Erro ao iniciar",
        description: "Não foi possível salvar o status da lista.",
        variant: "destructive"
      });
    } finally {
      setStartingShopping(false);
    }
  };

  const cancelShopping = async () => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from("shopping_lists")
        .update({
          status: 'open',
        })
        .eq("id", id);

      if (error) throw error;

      setList(prev => prev ? { ...prev, status: 'open' } : null);
      setIsShoppingMode(false);
    } catch (error) {
      console.error("Error cancelling shopping:", error);
      setIsShoppingMode(false);
    }
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
      const priceRecords = itemsWithPrices.map((item) => ({
        market_id: selectedMarket.id,
        product_id: item.product_id,
        price: itemPrices[item.id],
      }));

      for (const record of priceRecords) {
        const { data: existing } = await supabase
          .from("market_prices")
          .select("id")
          .eq("market_id", record.market_id)
          .eq("product_id", record.product_id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("market_prices")
            .update({ price: record.price, created_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("market_prices")
            .insert(record);
        }
      }

      await supabase
        .from("shopping_lists")
        .update({
          status: "closed",
          market_id: selectedMarket.id
        })
        .eq("id", id);

      setList(prev => prev ? { ...prev, status: "closed", market_id: selectedMarket.id } : null);
      setFinishDialogOpen(false);
      setIsShoppingMode(false);

    } catch (error) {
      console.error("Error saving prices:", error);
      toast({
        title: "Erro ao finalizar",
        description: "Verifique a conexão.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const duplicateList = async () => {
    if (!user || !list || !newListName.trim()) return;

    setDuplicating(true);
    try {
      const { data: newList, error: createError } = await supabase
        .from("shopping_lists")
        .insert({
          name: newListName.trim(),
          user_id: user.id,
          status: "open",
        })
        .select()
        .single();

      if (createError) throw createError;

      const newItems = items.map(item => ({
        list_id: newList.id,
        product_id: item.product_id,
        quantity: item.quantity,
        is_checked: false
      }));

      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from("list_items")
          .insert(newItems);

        if (insertError) throw insertError;
      }

      setDuplicateDialogOpen(false);
      navigate(`/lista/${newList.id}`);

    } catch (error) {
      console.error("Error duplicating list:", error);
      toast({
        title: "Erro ao duplicar",
        variant: "destructive",
      });
    } finally {
      setDuplicating(false);
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
  const isClosed = list?.status === 'closed';

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
    <div className="min-h-screen bg-background pb-8">
      {/* Header Atualizado com Menu Lateral e Lógica de Status */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-lg border-b border-border transition-all">
        <div className="flex items-center gap-2 px-4 py-4 max-w-md mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="h-10 w-10 -ml-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-display font-bold text-foreground truncate">{list.name}</h1>
              {isClosed && <Lock className="w-3 h-3 text-muted-foreground" />}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {isClosed
                ? (totalPrice > 0 ? `Total final: R$ ${totalPrice.toFixed(2)}` : "Lista Fechada")
                : isShoppingMode
                  ? `${checkedCount}/${items.length} itens • R$ ${totalPrice.toFixed(2)}`
                  : `${items.length} ${items.length === 1 ? "item" : "itens"}`
              }
            </p>
          </div>

          <div className="flex items-center gap-1">
            {!isShoppingMode && !isClosed && (
              <Button
                onClick={() => setAddDialogOpen(true)}
                size="icon"
                variant="secondary"
                className="h-10 w-10 rounded-xl text-primary"
              >
                <Plus className="w-6 h-6" />
              </Button>
            )}

            {/* Menu Lateral integrado ao Dropdown de opções da lista */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <MoreVertical className="w-5 h-5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuItem onClick={() => setEditNameDialogOpen(true)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar Nome
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteListDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Lista
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Botão do Menu Principal do App */}
            <AppMenu />
          </div>
        </div>

        {(isShoppingMode || (isClosed && selectedMarket)) && selectedMarket && (
          <div className="px-4 pb-3 max-w-md mx-auto">
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-lg text-sm border",
              isClosed
                ? "bg-muted text-muted-foreground border-border"
                : "bg-primary/10 text-primary border-primary/20"
            )}>
              <Store className="w-4 h-4" />
              <span className="font-medium truncate">
                {isClosed ? `Comprado em: ${selectedMarket.name}` : `Comprando em: ${selectedMarket.name}`}
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Items */}
      <main className="px-4 py-4 max-w-md mx-auto">
        {!isShoppingMode && !isClosed && items.length > 0 && (
          <div className="mb-6 animate-fade-in">
            <p className="text-sm text-muted-foreground mb-2 ml-1">
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
            icon={<Plus className="w-10 h-10 text-primary" />}
            title="Lista vazia"
            description="Adicione produtos à sua lista para começar"
            action={!isClosed && (
              <Button onClick={() => setAddDialogOpen(true)} className="h-12 px-6 rounded-xl">
                <Plus className="w-5 h-5 mr-2" />
                Adicionar Produto
              </Button>
            )}
          />
        ) : (
          <div className={cn("space-y-3", isClosed && "opacity-95")}>
            {items.map((item) => (
              <ProductItem
                key={item.id}
                id={item.id}
                name={item.products.name}
                brand={item.products.brand || undefined}
                quantity={item.quantity}
                isChecked={item.is_checked}
                price={itemPrices[item.id]}
                showPriceInput={isShoppingMode && !isClosed}
                readonly={isClosed}
                onToggleCheck={toggleCheck}
                onUpdateQuantity={updateQuantity}
                onUpdatePrice={updatePrice}
                onRemove={removeItem}
              />
            ))}
          </div>
        )}
      </main>

      {/* Bottom Actions */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border z-30 safe-bottom">
          <div className="max-w-md mx-auto space-y-3">
            {isClosed ? (
              <Button
                onClick={() => setDuplicateDialogOpen(true)}
                className="w-full h-14 rounded-xl text-lg font-medium shadow-lg shadow-primary/20"
                size="lg"
              >
                <Copy className="w-5 h-5 mr-2" />
                Utilizar Novamente
              </Button>
            ) : !isShoppingMode ? (
              <>
                <Button
                  onClick={startShopping}
                  className="w-full h-14 rounded-xl text-lg font-medium shadow-lg shadow-primary/20"
                  size="lg"
                  disabled={!selectedMarket || startingShopping}
                >
                  {startingShopping ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      Iniciar Compras
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => navigate(`/comparar/${id}`)}
                  variant="outline"
                  className="w-full h-12 rounded-xl border-border bg-background/50"
                >
                  <Scale className="w-5 h-5 mr-2" />
                  Comparar Preços
                </Button>
              </>
            ) : (
              <div className="flex gap-3">
                <Button
                  onClick={cancelShopping}
                  variant="outline"
                  className="flex-1 h-14 rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => setFinishDialogOpen(true)}
                  className="flex-1 h-14 rounded-xl shadow-lg shadow-primary/20"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Finalizar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialogs ... (mesmos dialogs de antes) */}
      <Dialog open={editNameDialogOpen} onOpenChange={setEditNameDialogOpen}>
        <DialogContent className="w-[90%] max-w-sm mx-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-center">Editar Nome</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              placeholder="Nome da lista"
              className="h-12 rounded-xl text-base"
              autoFocus
            />
            <Button
              onClick={updateListName}
              className="w-full h-12 rounded-xl text-base font-medium"
              disabled={!editingName.trim() || isUpdating}
            >
              {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteListDialogOpen} onOpenChange={setDeleteListDialogOpen}>
        <AlertDialogContent className="w-[90%] max-w-sm mx-auto rounded-2xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl text-destructive">Excluir Lista?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar a lista <strong>"{list.name}"</strong>? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 space-x-0 mt-4">
            <AlertDialogCancel disabled={isDeleting} className="flex-1 h-12 rounded-xl mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteList}
              disabled={isDeleting}
              className="flex-1 h-12 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="w-[90%] max-w-sm mx-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-center">Nova Lista</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground text-center">
              Dê um nome para a nova lista baseada em <strong>"{list.name}"</strong>
            </p>
            <Input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Nome da lista"
              className="h-12 rounded-xl text-base"
              autoFocus
            />
            <Button
              onClick={duplicateList}
              className="w-full h-12 rounded-xl text-base font-medium"
              disabled={!newListName.trim() || duplicating}
            >
              {duplicating ? <Loader2 className="w-5 h-5 animate-spin" /> : <> <Copy className="w-4 h-4 mr-2" /> Criar e Abrir </>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={closeAddDialog}>
        <DialogContent className="w-[95%] max-w-sm mx-auto rounded-2xl h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-2 border-b border-border/50 bg-background z-10">
            <DialogTitle className="font-display text-xl">
              Adicionar Produtos
              {selectedProducts.size > 0 && (
                <span className="ml-2 text-sm font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {selectedProducts.size}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 pb-2 bg-background z-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 rounded-xl bg-secondary/50 border-transparent focus:bg-background focus:border-primary transition-all"
                autoFocus
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
            {filteredProducts.map((product) => {
              const isInList = items.some((item) => item.product_id === product.id);
              const isSelected = selectedProducts.has(product.id);
              return (
                <button
                  key={product.id}
                  onClick={() => toggleProductSelection(product.id)}
                  disabled={isInList}
                  className={cn(
                    "w-full p-4 text-left rounded-xl transition-all duration-200 flex items-center gap-3 active:scale-[0.99]",
                    isInList
                      ? "opacity-60 cursor-not-allowed bg-muted/50"
                      : isSelected
                        ? "bg-primary/10 ring-2 ring-primary ring-inset"
                        : "bg-card border border-border hover:border-primary/50"
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
                        "w-3.5 h-3.5",
                        isInList ? "text-muted-foreground" : "text-primary-foreground"
                      )} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium truncate text-base",
                      isInList ? "text-muted-foreground" : "text-foreground"
                    )}>
                      {product.name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {isInList ? "Já está na lista" : product.brand || "Sem marca"}
                    </p>
                  </div>
                </button>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                <p>Nenhum produto encontrado</p>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-border bg-background z-10">
            <Button
              onClick={addSelectedProducts}
              className="w-full h-14 rounded-xl text-lg font-medium shadow-md"
              disabled={selectedProducts.size === 0 || addingProducts}
            >
              {addingProducts ? <Loader2 className="w-6 h-6 animate-spin" /> : <> <Plus className="w-5 h-5 mr-2" /> Adicionar {selectedProducts.size > 0 ? `${selectedProducts.size} produtos` : "Produtos"} </>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <AlertDialogContent className="w-[90%] max-w-sm mx-auto rounded-2xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">Finalizar Compras?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Os preços informados serão salvos e a lista será <strong>fechada</strong>.</p>
              <div className="bg-muted/50 p-4 rounded-xl border border-border/50">
                <p className="text-2xl font-bold text-foreground text-center">R$ {totalPrice.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground text-center mt-1">{Object.keys(itemPrices).filter((k) => itemPrices[k] > 0).length} produtos com preço</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 space-x-0 mt-4">
            <AlertDialogCancel disabled={saving} className="flex-1 h-12 rounded-xl mt-0">Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={finishShopping} disabled={saving} className="flex-1 h-12 rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Finalizar e Fechar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Search, Scale, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductItem } from "@/components/ProductItem";
import { EmptyState } from "@/components/EmptyState";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
      // Fetch list details
      const { data: listData, error: listError } = await supabase
        .from("shopping_lists")
        .select("*")
        .eq("id", id)
        .single();

      if (listError) throw listError;
      setList(listData);

      // Fetch list items with product details
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

  const addProduct = async (productId: string) => {
    if (!id) return;

    // Check if product already in list
    const existingItem = items.find((item) => item.product_id === productId);
    if (existingItem) {
      toast({
        title: "Item já existe",
        description: "Este produto já está na lista",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("list_items")
        .insert({
          list_id: id,
          product_id: productId,
          quantity: 1,
          is_checked: false,
        })
        .select(`
          id,
          product_id,
          quantity,
          is_checked,
          products (id, name, brand)
        `)
        .single();

      if (error) throw error;
      
      setItems([...items, data as ListItem]);
      setAddDialogOpen(false);
      setSearchQuery("");
      
      toast({
        title: "Item adicionado",
        description: `${(data as ListItem).products.name} foi adicionado à lista`,
      });
    } catch (error) {
      console.error("Error adding product:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o item",
        variant: "destructive",
      });
    }
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

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
    <div className="min-h-screen bg-background pb-24">
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
              {items.length} {items.length === 1 ? "item" : "itens"}
            </p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)} size="icon" variant="ghost" className="text-primary">
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      </header>

      {/* Items */}
      <main className="px-4 py-4 max-w-md mx-auto">
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
          <>
            <div className="space-y-2 mb-6">
              {items.map((item) => (
                <ProductItem
                  key={item.id}
                  id={item.id}
                  name={item.products.name}
                  brand={item.products.brand || undefined}
                  quantity={item.quantity}
                  isChecked={item.is_checked}
                  onToggleCheck={toggleCheck}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                />
              ))}
            </div>

            {/* Compare Button */}
            <Button
              onClick={() => navigate(`/comparar/${id}`)}
              className="w-full h-14"
              size="lg"
            >
              <Scale className="w-5 h-5" />
              Comparar Preços
            </Button>
          </>
        )}
      </main>

      {/* Add Product Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">Adicionar Produto</DialogTitle>
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
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addProduct(product.id)}
                  className="w-full p-3 text-left rounded-xl hover:bg-accent transition-colors"
                >
                  <p className="font-medium text-foreground">{product.name}</p>
                  {product.brand && (
                    <p className="text-sm text-muted-foreground">{product.brand}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

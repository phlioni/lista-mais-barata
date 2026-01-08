import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Search, Scale, Loader2, X, ShoppingCart,
  Check, Store, Copy, Lock, MoreVertical, Pencil, Trash2,
  AlertTriangle, Save, Camera, QrCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductItem } from "@/components/ProductItem";
import { EmptyState } from "@/components/EmptyState";
import { AppMenu } from "@/components/AppMenu";
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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ReceiptReconciliation, ScanResult } from "@/components/ReceiptReconciliation";
import { Scanner } from '@yudiel/react-qr-scanner';

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
  const params = useParams();
  const routeId = params.id;
  const routeMarketId = params.marketId;
  const routeListId = params.listId;

  const id = routeListId || routeId;
  const isCompareMode = !!routeMarketId;

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

  const [isProductMode, setIsProductMode] = useState<'create' | 'edit' | null>(null);
  const [editingProductData, setEditingProductData] = useState<{ id?: string, name: string, brand: string }>({ name: '', brand: '' });
  const [validatingProduct, setValidatingProduct] = useState(false);

  const [isShoppingMode, setIsShoppingMode] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [itemPrices, setItemPrices] = useState<ItemPrice>({});
  const [saving, setSaving] = useState(false);
  const [startingShopping, setStartingShopping] = useState(false);

  const [newListName, setNewListName] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  // Scanner States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showReconciliation, setShowReconciliation] = useState(false);

  // QR Code States
  const [isQRScanning, setIsQRScanning] = useState(false);

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

        if (routeMarketId) {
          await loadMarketData(routeMarketId, false, true);
        }

        setLoading(false);
      };
      init();

      const channel = supabase
        .channel('list-detail-prices')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'market_prices' },
          (payload) => {
            const currentMarketId = routeMarketId || list?.market_id || selectedMarket?.id;
            if (isCompareMode && currentMarketId && payload.new && (payload.new as any).market_id === currentMarketId) {
              loadMarketData(currentMarketId, isShoppingMode, true);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, id, routeMarketId, isShoppingMode, list?.market_id, selectedMarket?.id]);

  useEffect(() => {
    if (preselectedMarketId && usePrices && list && list.status === 'open' && !routeMarketId) {
      loadMarketData(preselectedMarketId, true, true);
    }
  }, [preselectedMarketId, usePrices, list, routeMarketId]);

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

      if (listData.market_id && !routeMarketId) {
        if (listData.status === 'closed') {
          await loadMarketData(listData.market_id, false, true);
        } else if (listData.status === 'shopping') {
          const shouldLoadPrices = isCompareMode || usePrices;
          await loadMarketData(listData.market_id, true, shouldLoadPrices);
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
    targetMarketId: string,
    enableShoppingMode: boolean = false,
    shouldFetchPrices: boolean = false
  ) => {
    try {
      const { data: marketData, error: marketError } = await supabase
        .from("markets")
        .select("*")
        .eq("id", targetMarketId)
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
            .eq("market_id", targetMarketId)
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
        setItemPrices(prev => {
          if (Object.keys(prev).length === 0) return {};
          return prev;
        });
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

    if (existingItem) {
      removeItem(existingItem.id);
      return;
    }

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
      setIsProductMode(null);
    }
    setAddDialogOpen(open);
  };

  const handleCreateOrUpdateProduct = async () => {
    if (!editingProductData.name.trim()) return;

    setValidatingProduct(true);
    try {
      const { data: validationData, error: validationError } = await supabase.functions.invoke('validate-product', {
        body: { name: editingProductData.name, brand: editingProductData.brand }
      });

      if (validationError) throw validationError;

      if (!validationData.isValid) {
        toast({
          title: "Produto inválido",
          description: validationData.reason || "O produto não parece válido.",
          variant: "destructive"
        });
        return;
      }

      const correctedName = validationData.correctedName;
      const correctedBrand = validationData.correctedBrand || null;

      let duplicateQuery = supabase.from('products')
        .select('*')
        .ilike('name', correctedName);

      if (correctedBrand) {
        duplicateQuery = duplicateQuery.eq('brand', correctedBrand);
      } else {
        duplicateQuery = duplicateQuery.is('brand', null);
      }

      const { data: duplicates } = await duplicateQuery;

      const isDuplicate = duplicates && duplicates.length > 0 &&
        (isProductMode === 'create' || (isProductMode === 'edit' && duplicates[0].id !== editingProductData.id));

      if (isDuplicate) {
        toast({
          title: "Produto já existe",
          description: `O produto "${correctedName}" ${correctedBrand ? `(${correctedBrand})` : ''} já está cadastrado.`,
          variant: "destructive"
        });
        return;
      }

      if (isProductMode === 'create') {
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({ name: correctedName, brand: correctedBrand })
          .select()
          .single();

        if (createError) throw createError;

        setProducts(prev => [...prev, newProduct]);
        toggleProductSelection(newProduct.id);

        toast({ title: "Produto criado", description: `${newProduct.name} foi adicionado.` });
      } else if (isProductMode === 'edit' && editingProductData.id) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ name: correctedName, brand: correctedBrand })
          .eq('id', editingProductData.id);

        if (updateError) throw updateError;

        setProducts(prev => prev.map(p => p.id === editingProductData.id ? { ...p, name: correctedName, brand: correctedBrand } : p));
        setItems(prev => prev.map(item => item.product_id === editingProductData.id ? {
          ...item,
          products: { ...item.products, name: correctedName, brand: correctedBrand }
        } : item));

        toast({ title: "Produto atualizado", description: "Alteração refletida para todos os usuários." });
      }

      setIsProductMode(null);
      setEditingProductData({ name: '', brand: '' });

    } catch (error) {
      console.error("Error saving product:", error);
      toast({
        title: "Erro ao salvar",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive"
      });
    } finally {
      setValidatingProduct(false);
    }
  };

  const startCreateProduct = () => {
    setIsProductMode('create');
    setEditingProductData({ name: searchQuery, brand: '' });
  };

  const startEditProduct = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProductMode('edit');
    setEditingProductData({ id: product.id, name: product.name, brand: product.brand || '' });
  };

  // --- SCANNER LOGIC (PHOTO) ---

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        const currentItemsContext = items.map(item => ({
          id: item.id,
          name: item.products.name,
          brand: item.products.brand
        }));

        const { data, error } = await supabase.functions.invoke('scan-receipt', {
          body: {
            imageBase64: base64String,
            currentItems: currentItemsContext
          }
        });

        if (error) throw error;

        console.log("Scan Result:", data);
        setScanResult(data);
        setShowReconciliation(true);
        setIsScanning(false);

        if (fileInputRef.current) fileInputRef.current.value = '';
      };

      reader.readAsDataURL(file);

    } catch (error) {
      console.error("Error scanning receipt:", error);
      toast({
        title: "Erro na leitura",
        description: "Não foi possível processar a imagem. Tente novamente.",
        variant: "destructive"
      });
      setIsScanning(false);
    }
  };

  // --- QR CODE LOGIC ---
  const handleQRScan = async (result: string) => {
    if (!result) return;

    setIsQRScanning(false);
    setIsScanning(true);
    toast({ title: "Processando...", description: "Consultando nota fiscal..." });

    console.log("QR Code detectado:", result);

    try {
      const { data, error } = await supabase.functions.invoke('scrape-nfce', {
        body: { url: result }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Falha na leitura");

      console.log("Itens NFC-e:", data.items);

      if (data.items.length === 0) {
        toast({
          title: "Nenhum item encontrado",
          description: "Não conseguimos ler os itens desta nota. Tente pela foto.",
          variant: "destructive"
        });
        return;
      }

      const newItemsFromQR = data.items.map((item: any) => ({
        name: item.name,
        price: item.total_price,
        quantity: item.quantity
      }));

      setScanResult({
        matched: [],
        review_needed: [],
        new_items: newItemsFromQR
      });

      setShowReconciliation(true);

    } catch (error) {
      console.error("Erro QR Code:", error);
      toast({
        title: "Erro ao consultar nota",
        description: "Tente novamente ou use a opção de foto.",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleReconciliationConfirm = async (data: {
    updates: Array<{ itemId: string; price: number }>;
    newItems: Array<{ name: string; price: number; quantity: number }>;
  }) => {

    // 1. Atualiza preços locais sem depender de reload
    const newPrices = { ...itemPrices };
    const itemsToUpdate = [...items];

    data.updates.forEach(update => {
      newPrices[update.itemId] = update.price;
      const idx = itemsToUpdate.findIndex(i => i.id === update.itemId);
      if (idx !== -1) {
        itemsToUpdate[idx] = { ...itemsToUpdate[idx], is_checked: true };
        toggleCheck(update.itemId);
      }
    });

    setItemPrices(newPrices);
    setItems(itemsToUpdate);

    // 2. Adiciona novos produtos
    if (data.newItems.length > 0) {
      for (const newItem of data.newItems) {
        try {
          // Usa a validação/IA para normalizar antes de criar
          const { data: validationData } = await supabase.functions.invoke('validate-product', {
            body: { name: newItem.name, brand: null }
          });

          const finalName = validationData?.isValid ? validationData.correctedName : newItem.name;
          const finalBrand = validationData?.isValid ? validationData.correctedBrand : null;

          // Cria produto
          const { data: productData, error: prodError } = await supabase
            .from('products')
            .insert({ name: finalName, brand: finalBrand })
            .select()
            .single();

          if (prodError) {
            console.log("Produto talvez já exista, buscando...", prodError);
            // Se falhar na criação (ex: duplicado), busca o existente
            // (Para implementar isso robustamente, seria ideal um upsert ou select antes)
            continue;
          }

          const { data: listItemData } = await supabase
            .from('list_items')
            .insert({
              list_id: id,
              product_id: productData.id,
              quantity: newItem.quantity,
              is_checked: true
            })
            .select(`
              id,
              product_id,
              quantity,
              is_checked,
              products (id, name, brand)
            `)
            .single();

          if (listItemData) {
            setItems(prev => [...prev, listItemData as ListItem]);
            setItemPrices(prev => ({ ...prev, [listItemData.id]: newItem.price }));
          }

        } catch (e) {
          console.error("Error processing new item from scan", e);
        }
      }
    }

    toast({
      title: "Lista atualizada",
      description: `${data.updates.length} itens atualizados e ${data.newItems.length} novos adicionados.`,
    });
  };

  // ----------------------------------------------------

  const toggleCheck = async (itemId: string) => {
    if (list?.status === 'closed' || isCompareMode) return;

    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const newCheckedState = !item.is_checked;
    setItems(prev => prev.map((i) =>
      i.id === itemId ? { ...i, is_checked: newCheckedState } : i
    ));

    try {
      const { error } = await supabase
        .from("list_items")
        .update({ is_checked: newCheckedState })
        .eq("id", itemId);

      if (error) {
        setItems(prev => prev.map((i) =>
          i.id === itemId ? { ...i, is_checked: !newCheckedState } : i
        ));
        throw error;
      }
    } catch (error) {
      console.error("Error toggling check:", error);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (list?.status === 'closed' || isCompareMode) return;

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
    if (list?.status === 'closed' || isCompareMode) return;
    setItemPrices((prev) => ({
      ...prev,
      [itemId]: price,
    }));
  };

  const removeItem = async (itemId: string) => {
    if (list?.status === 'closed' || isCompareMode) return;

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

      const shouldLoadPrices = isCompareMode;
      await loadMarketData(selectedMarket.id, true, shouldLoadPrices);

      if (!shouldLoadPrices) {
        setItemPrices(prev => {
          if (Object.keys(prev).length === 0) return {};
          return prev;
        });
      }

      items.forEach((item) => {
        if (item.is_checked) {
          toggleCheck(item.id);
        }
      });

      if (isCompareMode) {
        navigate(`/lista/${id}?usePrices=true`);
      }

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

      await Promise.all(priceRecords.map(async (record) => {
        const { data: existing } = await supabase
          .from("market_prices")
          .select("id")
          .eq("market_id", record.market_id)
          .eq("product_id", record.product_id)
          .maybeSingle();

        if (existing) {
          return supabase
            .from("market_prices")
            .update({ price: record.price, created_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          return supabase
            .from("market_prices")
            .insert(record);
        }
      }));

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
    <div className={cn("min-h-screen bg-background transition-all", items.length > 0 ? "pb-40" : "pb-8")}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
      />

      {/* QR Scanner Overlay */}
      {isQRScanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="p-4 flex justify-between items-center text-white bg-black/50 absolute top-0 w-full z-10">
            <h3 className="font-bold">Aponte para o QR Code</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsQRScanning(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center relative bg-black">
            <Scanner
              onScan={(result) => {
                // Correção: Verifica se há resultado válido
                if (result && result.length > 0 && result[0].rawValue) {
                  handleQRScan(result[0].rawValue);
                }
              }}
              onError={(error) => {
                console.error("Scanner error:", error);
                // Não fecha o scanner imediatamente, mas avisa
              }}
              // Configurações importantes para funcionar melhor
              constraints={{ facingMode: 'environment' }}
              formats={['qr_code']}
              components={{
                audio: false,
                onOff: true,
              }}
              styles={{
                container: { width: "100%", height: "100%" }
              }}
            />
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-lg border-b border-border transition-all">
        <div className="flex items-center gap-2 px-4 py-3 max-w-md mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => isCompareMode ? navigate(-1) : navigate("/")}
            className="h-10 w-10 -ml-2 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex-1 min-w-0 flex flex-col justify-center h-10">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-display font-bold text-foreground truncate">{list.name}</h1>
              {isClosed && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
            </div>

            <p className="text-xs text-muted-foreground truncate leading-none mt-0.5">
              {isClosed
                ? (totalPrice > 0 ? `Total: R$ ${totalPrice.toFixed(2)}` : "Fechada")
                : isShoppingMode
                  ? `${checkedCount}/${items.length} • R$ ${totalPrice.toFixed(2)}`
                  : isCompareMode
                    ? `Simulação • R$ ${totalPrice.toFixed(2)}`
                    : `${items.length} ${items.length === 1 ? "item" : "itens"}`
              }
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!isShoppingMode && !isClosed && !isCompareMode && (
              <Button
                onClick={() => setAddDialogOpen(true)}
                size="icon"
                variant="secondary"
                className="h-9 w-9 rounded-xl text-primary"
              >
                <Plus className="w-5 h-5" />
              </Button>
            )}

            {!isCompareMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
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
            )}

            <AppMenu />
          </div>
        </div>

        {(isShoppingMode || isCompareMode || (isClosed && selectedMarket)) && selectedMarket && (
          <div className="px-4 pb-3 max-w-md mx-auto">
            <div className={cn(
              "flex items-center gap-2 p-2 rounded-lg text-xs sm:text-sm border",
              isClosed
                ? "bg-muted text-muted-foreground border-border"
                : isCompareMode
                  ? "bg-secondary text-secondary-foreground border-secondary"
                  : "bg-primary/10 text-primary border-primary/20"
            )}>
              <Store className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium truncate">
                {isClosed
                  ? `Comprado: ${selectedMarket.name}`
                  : isCompareMode
                    ? `Preços: ${selectedMarket.name}`
                    : `No mercado: ${selectedMarket.name}`
                }
              </span>
            </div>
          </div>
        )}
      </header>

      <main className="px-4 py-4 max-w-md mx-auto">
        {!isShoppingMode && !isClosed && !isCompareMode && items.length > 0 && (
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
            action={!isClosed && !isCompareMode && (
              <Button onClick={() => setAddDialogOpen(true)} className="h-12 px-6 rounded-xl">
                <Plus className="w-5 h-5 mr-2" />
                Adicionar Produto
              </Button>
            )}
          />
        ) : (
          <div className={cn("space-y-3", (isClosed || isCompareMode) && "opacity-95")}>
            {items.map((item) => (
              <ProductItem
                key={item.id}
                id={item.id}
                name={item.products.name}
                brand={item.products.brand || undefined}
                quantity={item.quantity}
                isChecked={item.is_checked}
                price={itemPrices[item.id]}
                showPriceInput={isShoppingMode && !isClosed && !isCompareMode}
                readonly={isClosed || isCompareMode}
                onToggleCheck={toggleCheck}
                onUpdateQuantity={updateQuantity}
                onUpdatePrice={updatePrice}
                onRemove={removeItem}
              />
            ))}
          </div>
        )}
      </main>

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
            ) : isCompareMode ? (
              <div className="flex gap-3">
                <Button
                  onClick={() => navigate(-1)}
                  variant="outline"
                  className="flex-1 h-14 rounded-xl"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={startShopping}
                  className="flex-1 h-14 rounded-xl shadow-lg shadow-primary/20"
                  disabled={startingShopping}
                >
                  {startingShopping ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      Usar essa lista
                    </>
                  )}
                </Button>
              </div>
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
                  className="w-14 shrink-0 h-14 rounded-xl"
                  title="Cancelar"
                >
                  <X className="w-5 h-5" />
                </Button>

                {/* Botão de QR Code */}
                <Button
                  onClick={() => setIsQRScanning(true)}
                  variant="secondary"
                  className="w-14 shrink-0 h-14 rounded-xl border border-primary/20"
                  title="Escanear QR Code NFC-e"
                >
                  <QrCode className="w-5 h-5 text-primary" />
                </Button>

                {/* Botão de Foto 
                <Button
                  onClick={handleCameraClick}
                  variant="secondary"
                  className="w-14 shrink-0 h-14 rounded-xl border border-primary/20"
                  disabled={isScanning}
                  title="Tirar Foto da Nota"
                >
                  {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5 text-primary" />}
                </Button>
                */}
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

      <ReceiptReconciliation
        open={showReconciliation}
        onOpenChange={setShowReconciliation}
        scanResult={scanResult}
        currentItems={items.map(i => ({ id: i.id, name: i.products.name, brand: i.products.brand }))}
        onConfirm={handleReconciliationConfirm}
      />

      {/* Dialogs ... (Mantidos iguais ao original para economizar espaço, se necessário posso repetir) */}
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
          {isProductMode ? (
            <>
              <DialogHeader className="p-4 pb-2 border-b border-border/50 bg-background z-10">
                <DialogTitle className="font-display text-xl flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => setIsProductMode(null)}>
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  {isProductMode === 'create' ? 'Novo Produto' : 'Editar Produto'}
                </DialogTitle>
              </DialogHeader>
              <div className="p-4 space-y-4 flex-1 bg-background">
                <div className="bg-primary/5 p-3 rounded-lg flex gap-3 text-sm text-primary/80 mb-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p>Atenção: As alterações aqui são globais e afetam a busca de todos os usuários.</p>
                </div>

                <div className="space-y-2">
                  <Label>Nome do Produto</Label>
                  <Input
                    value={editingProductData.name}
                    onChange={(e) => setEditingProductData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Arroz Branco"
                    className="h-12 rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">O sistema corrigirá automaticamente a ortografia.</p>
                </div>
                <div className="space-y-2">
                  <Label>Marca (Opcional)</Label>
                  <Input
                    value={editingProductData.brand}
                    onChange={(e) => setEditingProductData(prev => ({ ...prev, brand: e.target.value }))}
                    placeholder="Ex: Tio João"
                    className="h-12 rounded-xl"
                  />
                </div>
              </div>
              <div className="p-4 border-t border-border bg-background z-10">
                <Button
                  onClick={handleCreateOrUpdateProduct}
                  className="w-full h-14 rounded-xl text-lg font-medium shadow-md"
                  disabled={!editingProductData.name.trim() || validatingProduct}
                >
                  {validatingProduct ? (
                    <> <Loader2 className="w-5 h-5 animate-spin mr-2" /> Validando... </>
                  ) : (
                    <> <Save className="w-5 h-5 mr-2" /> Salvar Produto </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
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
                {filteredProducts.length === 0 && searchQuery.length > 0 ? (
                  <div className="py-8 text-center space-y-3">
                    <p className="text-muted-foreground">Produto não encontrado.</p>
                    <Button
                      variant="secondary"
                      onClick={startCreateProduct}
                      className="rounded-xl border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 text-primary w-full h-12"
                    >
                      <Plus className="w-5 h-5 mr-2" /> Criar "{searchQuery}"
                    </Button>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>Digite para buscar...</p>
                    <Button variant="ghost" onClick={startCreateProduct} className="mt-2 rounded-xl">
                      <Plus className="w-4 h-4 mr-2" /> Criar novo produto
                    </Button>
                  </div>
                ) : (
                  filteredProducts.map((product) => {
                    const isInList = items.some((item) => item.product_id === product.id);
                    const isSelected = selectedProducts.has(product.id);

                    return (
                      <div key={product.id} className={cn(
                        "relative w-full rounded-xl border transition-all duration-200 flex items-center group",
                        isInList
                          ? "bg-muted/30 border-muted-foreground/20"
                          : isSelected
                            ? "bg-primary/10 border-primary ring-1 ring-primary"
                            : "bg-card border-border hover:border-primary/50"
                      )}>
                        <button
                          onClick={() => toggleProductSelection(product.id)}
                          className="flex-1 p-4 flex items-center gap-3 text-left min-w-0"
                        >
                          <div className={cn(
                            "flex items-center justify-center w-6 h-6 rounded-full border-2 flex-shrink-0 transition-all",
                            isInList
                              ? "border-muted-foreground bg-muted-foreground text-background"
                              : isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/30"
                          )}>
                            {(isInList || isSelected) && (
                              <Check className="w-3.5 h-3.5" />
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
                              {isInList ? "Toque para remover" : product.brand || "Sem marca"}
                            </p>
                          </div>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => startEditProduct(product, e)}
                          className="mr-2 h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors z-10 shrink-0"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })
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
            </>
          )}
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
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : "Finalizar e Fechar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
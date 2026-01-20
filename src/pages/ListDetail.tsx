import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Search,
  Scale,
  Loader2,
  X,
  ShoppingCart,
  Check,
  Store,
  Copy,
  Lock,
  MoreVertical,
  Pencil,
  Trash2,
  AlertTriangle,
  Save,
  Mic,
  Send,
  Sparkles,
  ArrowRight,
  StopCircle
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
import {
  ReceiptReconciliation,
  ScanResult,
} from "@/components/ReceiptReconciliation";
import { Scanner } from "@yudiel/react-qr-scanner";
import { MagicPasteImport } from "@/components/MagicPasteImport";

// --- Definições para Web Speech API ---
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

// Helper para timeout seguro
const safeInvoke = async <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn("Timeout/Error in async operation, using fallback");
      resolve(fallback);
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (error) {
    console.warn("Exception in async operation:", error);
    clearTimeout(timer);
    return fallback;
  }
};

interface Product {
  id: string;
  name: string;
  brand: string | null;
  measurement: string | null;
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

interface SmartMatchDetail {
  matchedProductId: string;
  matchedProductName: string;
  matchedProductBrand: string | null;
  isSubstitution: boolean;
}

export default function ListDetail() {
  const params = useParams();
  const routeId = params.id;
  const routeMarketId = params.marketId;
  const routeListId = params.listId;

  const id = routeListId || routeId;

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const preselectedMarketId = searchParams.get("marketId");
  const usePrices = searchParams.get("usePrices") === "true";
  const strategy = searchParams.get("strategy") || "cheapest";

  const isCompareMode = !!routeMarketId || (!!preselectedMarketId && usePrices);

  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat Input State
  const [chatInput, setChatInput] = useState("");
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [listFilter, setListFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [confirmUpdateDialogOpen, setConfirmUpdateDialogOpen] = useState(false);

  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [deleteListDialogOpen, setDeleteListDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set()
  );
  const [addingProducts, setAddingProducts] = useState(false);

  const [isProductMode, setIsProductMode] = useState<"create" | "edit" | null>(
    null
  );
  const [editingProductData, setEditingProductData] = useState<{
    id?: string;
    name: string;
    brand: string;
    measurement: string;
  }>({ name: "", brand: "", measurement: "" });
  const [validatingProduct, setValidatingProduct] = useState(false);

  const [isShoppingMode, setIsShoppingMode] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [itemPrices, setItemPrices] = useState<ItemPrice>({});

  const [smartMatches, setSmartMatches] = useState<Record<string, SmartMatchDetail>>({});

  const [saving, setSaving] = useState(false);
  const [startingShopping, setStartingShopping] = useState(false);

  const [newListName, setNewListName] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showReconciliation, setShowReconciliation] = useState(false);

  const [isQRScanning, setIsQRScanning] = useState(false);

  const [processingStatus, setProcessingStatus] = useState<{
    current: number;
    total: number;
    currentItemName?: string;
  } | null>(null);

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
          await loadSmartMarketData(routeMarketId);
        }

        setLoading(false);
      };
      init();

      const channel = supabase
        .channel("list-detail-prices")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "market_prices" },
          (payload) => {
            const currentMarketId =
              routeMarketId || list?.market_id || selectedMarket?.id;

            if (
              !isCompareMode &&
              currentMarketId &&
              payload.new &&
              (payload.new as any).market_id === currentMarketId
            ) {
              loadMarketData(currentMarketId, isShoppingMode, true);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [
    user,
    id,
    routeMarketId,
    isShoppingMode,
    list?.market_id,
    selectedMarket?.id,
  ]);

  useEffect(() => {
    if (
      preselectedMarketId &&
      usePrices &&
      list &&
      list.status === "open" &&
      !routeMarketId
    ) {
      loadSmartMarketData(preselectedMarketId);
    }
  }, [preselectedMarketId, usePrices, list, routeMarketId]);

  useEffect(() => {
    const windowObj = window as unknown as IWindow;
    const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "pt-BR";

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput((prev) => (prev ? `${prev}, ${transcript}` : transcript));
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Erro no reconhecimento de voz", event.error);
        setIsListening(false);
        toast({
          title: "Erro no áudio",
          description: "Não foi possível ouvir. Tente digitar.",
          variant: "destructive"
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
      toast({
        title: "Ouvindo...",
        description: "Pode falar os itens (ex: Arroz, Feijão...)",
        duration: 2000,
      });
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !id) return;

    const textToSend = chatInput;
    setChatInput("");
    setIsProcessingChat(true);

    try {
      const { data, error } = await supabase.functions.invoke('parse-smart-list', {
        body: { text: textToSend }
      });

      if (error) throw error;

      const parsedItems = data.items || [];

      if (parsedItems.length === 0) {
        toast({ title: "Nenhum item identificado", variant: "destructive" });
        return;
      }

      const newItems: ListItem[] = [];
      const itemsToSkip: string[] = [];

      for (const item of parsedItems) {
        const nameAlreadyInList = items.some(
          existing => existing.products.name.toLowerCase() === item.name.toLowerCase()
        );

        if (nameAlreadyInList) {
          itemsToSkip.push(item.name);
          continue;
        }

        let productId = "";

        const { data: existingProd } = await supabase
          .from("products")
          .select("id")
          .ilike("name", item.name)
          .is("brand", null)
          .maybeSingle();

        if (existingProd) {
          productId = existingProd.id;
        } else {
          const { data: newProd, error: createError } = await supabase
            .from("products")
            .insert({ name: item.name, brand: null })
            .select()
            .single();

          if (newProd) productId = newProd.id;
        }

        if (productId) {
          const alreadyInListId = items.some(i => i.product_id === productId);
          const alreadyInBatch = newItems.some(i => i.product_id === productId);

          if (alreadyInListId || alreadyInBatch) {
            if (!itemsToSkip.includes(item.name)) itemsToSkip.push(item.name);
            continue;
          }

          const { data: listItem } = await supabase
            .from("list_items")
            .insert({
              list_id: id,
              product_id: productId,
              quantity: 1,
              is_checked: false
            })
            .select(`
                id,
                product_id,
                quantity,
                is_checked,
                products (id, name, brand, measurement)
              `)
            .single();

          if (listItem) {
            newItems.push(listItem as ListItem);
          }
        }
      }

      setItems(prev => [...prev, ...newItems]);

      if (newItems.length > 0) {
        toast({ title: `${newItems.length} item(s) adicionado(s)!` });
      }

      if (itemsToSkip.length > 0) {
        toast({
          title: "Itens já na lista",
          description: `Ignorados: ${itemsToSkip.join(", ")}`,
          duration: 3000
        });
      }

    } catch (error) {
      console.error("Erro ao processar chat:", error);
      toast({
        title: "Erro ao adicionar",
        description: "Tente novamente.",
        variant: "destructive"
      });
      setChatInput(textToSend);
    } finally {
      setIsProcessingChat(false);
    }
  };

  const sortedItems = useMemo(() => {
    const hasAnyPrice = Object.keys(itemPrices).length > 0;
    const itemsCopy = [...items];

    if (hasAnyPrice || isShoppingMode || isCompareMode) {
      return itemsCopy.sort((a, b) => {
        const priceA = itemPrices[a.id] || 0;
        const priceB = itemPrices[b.id] || 0;
        const hasPriceA = priceA > 0;
        const hasPriceB = priceB > 0;

        if (hasPriceA && !hasPriceB) return -1;
        if (!hasPriceA && hasPriceB) return 1;

        return a.products.name.localeCompare(b.products.name);
      });
    }
    return itemsCopy;
  }, [items, itemPrices, isShoppingMode, isCompareMode]);

  const filteredListItems = useMemo(() => {
    if (!listFilter.trim()) return sortedItems;
    const lowerFilter = listFilter.toLowerCase();

    return sortedItems.filter((item) => {
      const productName = item.products.name.toLowerCase();
      const productBrand = item.products.brand?.toLowerCase() || "";
      return productName.includes(lowerFilter) || productBrand.includes(lowerFilter);
    });
  }, [sortedItems, listFilter]);

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
        .select(
          `
          id,
          product_id,
          quantity,
          is_checked,
          products (id, name, brand, measurement)
        `
        )
        .eq("list_id", id)
        .order("created_at");

      if (itemsError) throw itemsError;
      setItems(itemsData as ListItem[]);

      if (listData.market_id && !routeMarketId) {
        if (listData.status === "closed") {
          await loadMarketData(listData.market_id, false, true);
        } else if (listData.status === "shopping") {
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
        .select("id, name, brand, measurement")
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const loadSmartMarketData = async (targetMarketId: string) => {
    try {
      const { data: marketData, error: marketError } = await supabase
        .from("markets")
        .select("*")
        .eq("id", targetMarketId)
        .single();

      if (marketError) throw marketError;
      setSelectedMarket(marketData);

      const { data, error } = await supabase.functions.invoke('smart-shopping-analysis', {
        body: {
          listId: id,
          targetMarketId: targetMarketId,
          strategy: strategy
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const result = data.results && data.results[0];
      if (result && result.matches) {
        const newPrices: ItemPrice = {};
        const newSmartMatches: Record<string, SmartMatchDetail> = {};

        result.matches.forEach((match: any) => {
          newPrices[match.listItemId] = match.matchedPrice;
          newSmartMatches[match.listItemId] = {
            matchedProductId: match.matchedProductId,
            matchedProductName: match.matchedProductName,
            matchedProductBrand: match.matchedProductBrand,
            isSubstitution: match.isSubstitution
          };
        });

        setItemPrices(newPrices);
        setSmartMatches(newSmartMatches);
      }

    } catch (error) {
      console.error("Error loading smart market data:", error);
      loadMarketData(targetMarketId, false, true);
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

      let initialPrices: ItemPrice = {};

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

            pricesData.forEach((price: any) => {
              const itemId = productToItem[price.product_id];
              if (itemId) {
                initialPrices[itemId] = price.price;
              }
            });
          }
        }
      }

      if (id) {
        const localPricesJson = localStorage.getItem(`list_prices_${id}`);
        if (localPricesJson) {
          try {
            const localPrices = JSON.parse(localPricesJson);
            initialPrices = { ...initialPrices, ...localPrices };
          } catch (e) {
            console.error("Erro ao ler preços locais", e);
          }
        }
      }

      setItemPrices(initialPrices);

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

      setList((prev) => (prev ? { ...prev, name: editingName.trim() } : null));
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

      localStorage.removeItem(`list_prices_${id}`);
      navigate("/listas"); // --- CORREÇÃO: Volta para /listas ---
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

  const toggleCheck = async (itemId: string) => {
    if (list?.status === "closed" || isCompareMode) return;

    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const newCheckedState = !item.is_checked;
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, is_checked: newCheckedState } : i
      )
    );

    try {
      const { error } = await supabase
        .from("list_items")
        .update({ is_checked: newCheckedState })
        .eq("id", itemId);

      if (error) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId ? { ...i, is_checked: !newCheckedState } : i
          )
        );
        throw error;
      }
    } catch (error) {
      console.error("Error toggling check:", error);
    }
  };

  const handleReconciliationConfirm = async (data: {
    updates: Array<{ itemId: string; price: number }>;
    newItems: Array<{ name: string; price: number; quantity: number }>;
  }) => {

    setProcessingStatus({ current: 0, total: data.newItems.length + data.updates.length, currentItemName: "Atualizando..." });
    const newPrices = { ...itemPrices };
    const itemsToUpdate = [...items];

    data.updates.forEach((update) => {
      newPrices[update.itemId] = update.price;
      const idx = itemsToUpdate.findIndex((i) => i.id === update.itemId);
      if (idx !== -1) {
        itemsToUpdate[idx] = { ...itemsToUpdate[idx], is_checked: true };
        toggleCheck(update.itemId);
      }
    });

    if (id) {
      localStorage.setItem(`list_prices_${id}`, JSON.stringify(newPrices));
    }

    setItemPrices(newPrices);
    setItems(itemsToUpdate);

    if (data.newItems.length > 0) {
      const batchSize = 5;
      const addedItems: ListItem[] = [];

      for (let i = 0; i < data.newItems.length; i += batchSize) {
        const batch = data.newItems.slice(i, i + batchSize);
        setProcessingStatus({ current: i, total: data.newItems.length, currentItemName: "Adicionando itens..." });

        const results = await Promise.all(batch.map(async (newItem) => {
          try {
            const validationData = await safeInvoke(
              supabase.functions.invoke("validate-product", { body: { name: newItem.name } }),
              8000, { data: { isValid: false } }
            );
            const finalName = validationData.data?.isValid ? validationData.data.correctedName : newItem.name;

            let pid = "";
            const { data: p } = await supabase.from("products").insert({ name: finalName }).select().single();
            if (p) pid = p.id;
            else {
              const { data: ex } = await supabase.from("products").select("id").eq("name", finalName).maybeSingle();
              if (ex) pid = ex.id;
            }

            if (pid) {
              const { data: li } = await supabase.from("list_items").insert({
                list_id: id, product_id: pid, quantity: newItem.quantity, is_checked: true
              }).select(`id, product_id, quantity, is_checked, products (id, name, brand, measurement)`).single();
              if (li) {
                newPrices[li.id] = newItem.price;
                return li as ListItem;
              }
            }
          } catch (e) { return null; }
        }));

        results.forEach(r => { if (r) addedItems.push(r) });
      }
      setItems(prev => [...prev, ...addedItems]);
      setItemPrices(prev => ({ ...prev, ...newPrices }));

      if (id) {
        localStorage.setItem(`list_prices_${id}`, JSON.stringify(newPrices));
      }
    }
    setProcessingStatus(null);
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (list?.status === "closed" || isCompareMode) return;

    setItems(items.map((i) => (i.id === itemId ? { ...i, quantity } : i)));

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
    if (list?.status === "closed" || isCompareMode) return;

    setItemPrices((prev) => {
      const newPrices = { ...prev, [itemId]: price };
      if (id) {
        localStorage.setItem(`list_prices_${id}`, JSON.stringify(newPrices));
      }
      return newPrices;
    });
  };

  const updateProductBrand = async (itemId: string, newBrand: string) => {
    if (list?.status === "closed" || isCompareMode) return;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            products: { ...item.products, brand: newBrand },
          };
        }
        return item;
      })
    );

    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    try {
      const { error } = await supabase
        .from("products")
        .update({ brand: newBrand || null })
        .eq("id", item.product_id);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating brand:", error);
      toast({ title: "Erro ao salvar marca", variant: "destructive" });
    }
  };

  const removeItem = async (itemId: string) => {
    if (list?.status === "closed" || isCompareMode) return;

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
        .select(
          `
          id,
          product_id,
          quantity,
          is_checked,
          products (id, name, brand, measurement)
        `
        );

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

  const startCreateProduct = () => {
    setIsProductMode("create");
    setEditingProductData({ name: searchQuery, brand: "", measurement: "" });
  };

  const startEditProduct = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProductMode("edit");
    setEditingProductData({
      id: product.id,
      name: product.name,
      brand: product.brand || "",
      measurement: product.measurement || "",
    });
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        const currentItemsContext = items.map((item) => ({
          id: item.id,
          name: item.products.name,
          brand: item.products.brand,
        }));

        const { data, error } = await supabase.functions.invoke(
          "scan-receipt",
          {
            body: {
              imageBase64: base64String,
              currentItems: currentItemsContext,
            },
          }
        );

        if (error) throw error;

        console.log("Scan Result:", data);
        setScanResult(data);
        setShowReconciliation(true);
        setIsScanning(false);

        if (fileInputRef.current) fileInputRef.current.value = "";
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error scanning receipt:", error);
      toast({
        title: "Erro na leitura",
        description: "Não foi possível processar a imagem. Tente novamente.",
        variant: "destructive",
      });
      setIsScanning(false);
    }
  };

  const handleQRScan = async (result: string) => {
    if (!result) return;

    if (!result.startsWith("http")) {
      toast({
        title: "QR Code Inválido",
        description: "Não parece ser um link de nota fiscal.",
        variant: "destructive",
      });
      setIsQRScanning(false);
      return;
    }

    setIsQRScanning(false);
    setIsScanning(true);
    setProcessingStatus({ current: 0, total: 100, currentItemName: "Lendo dados da nota..." });

    try {
      const { data, error } = await supabase.functions.invoke("scrape-nfce", {
        body: { url: result.trim() },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Falha na leitura");

      if (data.items.length === 0) {
        toast({
          title: "Nenhum item encontrado",
          description:
            "Acessamos a nota, mas o layout pode ser incompatível.",
          variant: "destructive",
        });
        setProcessingStatus(null);
        return;
      }

      const scannedItems = data.items;
      setProcessingStatus({ current: 0, total: scannedItems.length, currentItemName: "Iniciando importação..." });

      const newPrices = { ...itemPrices };
      const newItemsAdded: ListItem[] = [];

      const batchSize = 5;
      for (let i = 0; i < scannedItems.length; i += batchSize) {
        const batch = scannedItems.slice(i, i + batchSize);

        setProcessingStatus({
          current: Math.min(i + batch.length, scannedItems.length),
          total: scannedItems.length,
          currentItemName: (batch[0] as any).name || "Item...",
        });

        if (i > 0) await new Promise(r => setTimeout(r, 300));

        const batchResults = await Promise.all(
          batch.map(async (scannedItem: any) => {
            try {
              const validationData = await safeInvoke(
                supabase.functions.invoke("validate-product", {
                  body: { name: scannedItem.name, brand: null },
                }),
                8000,
                { data: { isValid: false } }
              );

              const finalName = validationData.data?.isValid
                ? validationData.data.correctedName
                : scannedItem.name;
              const finalBrand = validationData.data?.isValid
                ? validationData.data.correctedBrand
                : null;
              const finalMeasurement = validationData.data?.isValid
                ? validationData.data.detectedMeasurement
                : null;

              let productId: string;

              const { data: productData, error: prodError } = await supabase
                .from("products")
                .insert({
                  name: finalName,
                  brand: finalBrand,
                  measurement: finalMeasurement,
                })
                .select()
                .single();

              if (prodError) {
                const { data: existingProd } = await supabase
                  .from("products")
                  .select("id")
                  .eq("name", finalName)
                  .eq("brand", finalBrand || null)
                  .maybeSingle();

                if (existingProd) {
                  productId = existingProd.id;
                } else {
                  const { data: rawProd } = await supabase
                    .from("products")
                    .insert({ name: scannedItem.name, brand: null })
                    .select()
                    .single();

                  if (!rawProd) {
                    const { data: rawExist } = await supabase.from("products").select("id").eq("name", scannedItem.name).maybeSingle();
                    productId = rawExist?.id || "";
                  } else {
                    productId = rawProd.id;
                  }
                }
              } else {
                productId = productData.id;
              }

              if (!productId) {
                console.error("Falha fatal ao obter ID do produto:", scannedItem.name);
                return null;
              }

              const { data: listItemData } = await supabase
                .from("list_items")
                .insert({
                  list_id: id,
                  product_id: productId,
                  quantity: scannedItem.quantity,
                  is_checked: true,
                })
                .select(
                  `
                  id,
                  product_id,
                  quantity,
                  is_checked,
                  products (id, name, brand, measurement)
                `
                )
                .single();

              if (listItemData) {
                return {
                  type: 'new',
                  item: listItemData as ListItem,
                  price: scannedItem.unit_price,
                  id: listItemData.id
                };
              }
              return null;

            } catch (e) {
              console.error("Erro processando item individual:", scannedItem.name, e);
              return null;
            }
          })
        );

        batchResults.forEach((res) => {
          if (res && res.type === 'new') {
            newItemsAdded.push(res.item);
            newPrices[res.id] = res.price;
          }
        });
      }

      setItems((prev) => [...prev, ...newItemsAdded]);

      const mergedPrices = { ...itemPrices, ...newPrices };
      setItemPrices(mergedPrices);
      if (id) {
        localStorage.setItem(`list_prices_${id}`, JSON.stringify(mergedPrices));
      }

      toast({
        title: "Importação Concluída!",
        description: `${newItemsAdded.length} de ${scannedItems.length} itens importados com sucesso.`,
      });

    } catch (error: any) {
      console.error("Erro QR Code Flow:", error);
      toast({
        title: "Erro ao processar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setProcessingStatus(null);
      setIsScanning(false);
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

    const hasSubstitutions = Object.values(smartMatches).some(m => m.isSubstitution);
    if (isCompareMode && hasSubstitutions) {
      setConfirmUpdateDialogOpen(true);
      return;
    }

    await proceedToStartShopping();
  };

  const proceedToStartShopping = async () => {
    setStartingShopping(true);
    try {
      if (isCompareMode) {
        const substitutions = Object.entries(smartMatches).filter(([_, val]) => val.isSubstitution);
        if (substitutions.length > 0) {
          for (const [listItemId, match] of substitutions) {
            await supabase
              .from('list_items')
              .update({ product_id: match.matchedProductId })
              .eq('id', listItemId);
          }
        }
      }

      const { error } = await supabase
        .from("shopping_lists")
        .update({
          status: "shopping",
          market_id: selectedMarket!.id,
        })
        .eq("id", id!);

      if (error) throw error;

      setList((prev) =>
        prev
          ? { ...prev, status: "shopping", market_id: selectedMarket!.id }
          : null
      );

      setIsShoppingMode(true);

      const shouldLoadPrices = isCompareMode;
      await loadMarketData(selectedMarket!.id, true, shouldLoadPrices);

      if (!shouldLoadPrices) {
        setItemPrices((prev) => {
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
        variant: "destructive",
      });
    } finally {
      setStartingShopping(false);
      setConfirmUpdateDialogOpen(false);
    }
  };

  const cancelShopping = async () => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from("shopping_lists")
        .update({
          status: "open",
        })
        .eq("id", id);

      if (error) throw error;

      setList((prev) => (prev ? { ...prev, status: "open" } : null));
      setIsShoppingMode(false);
      localStorage.removeItem(`list_prices_${id}`);

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

      await Promise.all(
        priceRecords.map(async (record) => {
          const { data: existing } = await supabase
            .from("market_prices")
            .select("id")
            .eq("market_id", record.market_id)
            .eq("product_id", record.product_id)
            .maybeSingle();

          if (existing) {
            return supabase
              .from("market_prices")
              .update({
                price: record.price,
                created_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
          } else {
            return supabase.from("market_prices").insert(record);
          }
        })
      );

      await supabase
        .from("shopping_lists")
        .update({
          status: "closed",
          market_id: selectedMarket.id,
        })
        .eq("id", id);

      setList((prev) =>
        prev
          ? { ...prev, status: "closed", market_id: selectedMarket.id }
          : null
      );

      localStorage.removeItem(`list_prices_${id}`);

      try {
        const { data: pointsResult, error: pointsError } = await supabase.rpc('award_weekly_points');

        if (!pointsError && pointsResult && typeof pointsResult === 'object') {
          // @ts-ignore
          const success = pointsResult.success;
          // @ts-ignore
          const message = pointsResult.message;

          toast({
            title: success ? "🎉 Lista Finalizada & Pontos!" : "Lista Finalizada!",
            description: message || "Lista salva com sucesso.",
            duration: success ? 6000 : 4000,
            className: success ? "border-green-500 bg-green-50" : ""
          });
        } else {
          toast({ title: "Lista Finalizada com Sucesso!" });
        }
      } catch (err) {
        console.warn("Erro ao processar pontos (ignorado):", err);
        toast({ title: "Lista Finalizada com Sucesso!" });
      }

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

      const newItems = items.map((item) => ({
        list_id: newList.id,
        product_id: item.product_id,
        quantity: item.quantity,
        is_checked: false,
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

  const totalPrice = Object.entries(itemPrices).reduce(
    (acc, [itemId, price]) => {
      const item = items.find((i) => i.id === itemId);
      return acc + price * (item?.quantity || 1);
    },
    0
  );

  const checkedCount = items.filter((i) => i.is_checked).length;
  const isClosed = list?.status === "closed";

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

  const substitutionsList = items
    .filter(item => smartMatches[item.id]?.isSubstitution)
    .map(item => {
      const match = smartMatches[item.id];
      return {
        original: `${item.products.name} ${item.products.brand || ''}`,
        new: `${match.matchedProductName} ${match.matchedProductBrand || ''}`
      }
    });

  const isSimpleMode = !isShoppingMode && !isClosed && !isCompareMode;

  return (
    <div
      className={cn(
        "min-h-screen bg-background transition-all",
        items.length > 0 ? "pb-40" : "pb-8"
      )}
    >
      {/* OVERLAY DE PROCESSAMENTO */}
      {processingStatus && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
          <h3 className="text-xl font-bold mb-1">Processando Lista...</h3>
          <p className="text-white/70 text-sm mb-4">
            {processingStatus.currentItemName
              ? `Importando: ${processingStatus.currentItemName.substring(0, 25)}...`
              : "Aguarde..."}
          </p>
          <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${(processingStatus.current / processingStatus.total) * 100
                  }%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-white/50">
            {processingStatus.current} de {processingStatus.total} itens
          </p>
        </div>
      )}

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
                if (result && result.length > 0 && result[0].rawValue) {
                  handleQRScan(result[0].rawValue);
                }
              }}
              onError={(error) => {
                console.error("Scanner error:", error);
              }}
              constraints={{ facingMode: "environment" }}
              formats={["qr_code"]}
              components={{
                audio: false,
                onOff: true,
              }}
              styles={{
                container: { width: "100%", height: "100%" },
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
            onClick={() => (isCompareMode ? navigate(-1) : navigate("/listas"))} // CORREÇÃO: Volta para /listas (Index)
            className="h-10 w-10 -ml-2 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex-1 min-w-0 flex flex-col justify-center h-10">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-display font-bold text-foreground truncate">
                {list.name}
              </h1>
              {isClosed && (
                <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
              )}
            </div>

            <p className="text-xs text-muted-foreground truncate leading-none mt-0.5">
              {isClosed
                ? totalPrice > 0
                  ? `Total: R$ ${totalPrice.toFixed(2)}`
                  : "Fechada"
                : isShoppingMode
                  ? `${checkedCount}/${items.length} • R$ ${totalPrice.toFixed(2)}`
                  : isCompareMode
                    ? `Simulação • R$ ${totalPrice.toFixed(2)}`
                    : `${items.length} ${items.length === 1 ? "item" : "itens"}`}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
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
            <div
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg text-xs sm:text-sm border",
                isClosed
                  ? "bg-muted text-muted-foreground border-border"
                  : isCompareMode
                    ? "bg-secondary text-secondary-foreground border-secondary"
                    : "bg-primary/10 text-primary border-primary/20"
              )}
            >
              <Store className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium truncate">
                {isClosed
                  ? `Comprado: ${selectedMarket.name}`
                  : isCompareMode
                    ? `Preços: ${selectedMarket.name}`
                    : `No mercado: ${selectedMarket.name}`}
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
            icon={<Sparkles className="w-10 h-10 text-primary" />}
            title="Sua lista inteligente"
            description="Use a barra abaixo para digitar ou falar os itens que você precisa (ex: Arroz, Feijão e Batata)."
            action={null} // REMOVIDOS BOTÕES DE AÇÃO EXTRA
          />
        ) : (
          <div className={cn("space-y-3", (isClosed || isCompareMode) && "opacity-95")}>
            {/* CAMPO DE BUSCA DA LISTA */}
            {items.length > 5 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar na lista..."
                  className="pl-9 pr-9 h-10 rounded-xl bg-secondary/30 border-transparent focus:bg-background"
                  value={listFilter}
                  onChange={(e) => setListFilter(e.target.value)}
                />
                {listFilter && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent text-muted-foreground"
                    onClick={() => setListFilter("")}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}

            {filteredListItems.map((item) => {
              const match = isCompareMode ? smartMatches[item.id] : null;
              const displayName = match ? match.matchedProductName : item.products.name;
              const displayBrand = match
                ? (match.matchedProductBrand || "")
                : (item.products.brand || "");

              return (
                <div key={item.id} className="flex flex-col mb-2">
                  <div className="relative z-10">
                    {/* AQUI REMOVI A TAG DE ECONOMIA VISUALMENTE */}
                    <ProductItem
                      id={item.id}
                      name={displayName}
                      brand={displayBrand}
                      measurement={item.products.measurement}
                      quantity={item.quantity}
                      isChecked={item.is_checked}
                      price={itemPrices[item.id]}
                      showPriceInput={isShoppingMode && !isClosed && !isCompareMode}
                      readonly={isClosed || isCompareMode}
                      isSimpleMode={isSimpleMode} // Passa o novo modo
                      onToggleCheck={toggleCheck}
                      onUpdateQuantity={updateQuantity}
                      onUpdatePrice={updatePrice}
                      onUpdateBrand={updateProductBrand} // Passa função de atualizar marca
                      onRemove={removeItem}
                    />
                  </div>

                  {isCompareMode && match?.isSubstitution && (
                    <div className="-mt-3 pt-4 pb-1.5 px-3 bg-indigo-50 border-x border-b border-indigo-100 rounded-b-xl mx-1 text-[10px] text-indigo-700 flex justify-end items-center gap-1.5 shadow-sm overflow-hidden">
                      <span className="text-indigo-400 shrink-0">Substituiu:</span>
                      <span className="font-medium truncate max-w-[140px] sm:max-w-[200px] min-w-0">
                        {item.products.name}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* --- NOVA BARRA DE CHAT/ADICIONAR --- */}
      {!isClosed && !isCompareMode && !isShoppingMode && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-background border-t border-border z-50 safe-bottom">
          <div className="max-w-md mx-auto flex gap-2 items-center">
            <Button
              variant={isListening ? "destructive" : "secondary"}
              size="icon"
              className={cn(
                "h-12 w-12 rounded-full shrink-0 shadow-sm transition-all",
                isListening && "animate-pulse ring-4 ring-destructive/30"
              )}
              onClick={toggleListening}
            >
              {isListening ? <StopCircle className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>

            <div className="flex-1 relative">
              <Input
                placeholder={isListening ? "Ouvindo..." : "Escreva: Arroz, Feijão..."}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="h-12 rounded-full pl-5 pr-12 shadow-sm bg-secondary/20 border-transparent focus:bg-background focus:border-primary"
                disabled={isProcessingChat}
              />
              <Button
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full"
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isProcessingChat}
              >
                {isProcessingChat ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Botões de Ação Secundários (Iniciar/Comparar) */}
          {items.length > 0 && (
            <div className="max-w-md mx-auto grid grid-cols-2 gap-3 mt-3">
              <Button
                onClick={() => navigate(`/comparar/${id}`)}
                variant="outline"
                className="h-12 rounded-xl border-border bg-background"
              >
                <Scale className="w-5 h-5 mr-2" />
                Comparar
              </Button>
              <Button
                onClick={startShopping}
                className="h-12 rounded-xl shadow-lg shadow-primary/20"
                disabled={!selectedMarket || startingShopping}
              >
                {startingShopping ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Iniciar
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* FOOTER P/ MODOS ESPECIAIS (SHOPPING/COMPARE) */}
      {(isShoppingMode || isCompareMode || isClosed) && items.length > 0 && (
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
            ) : (
              // MODO SHOPPING ATIVO
              <div className="flex gap-3">
                <Button
                  onClick={cancelShopping}
                  variant="outline"
                  className="w-14 shrink-0 h-14 rounded-xl"
                  title="Cancelar"
                >
                  <X className="w-5 h-5" />
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

      {/* DIALOGS MANTIDOS (Renomear, Deletar, Duplicar, Confirmar Update, etc) */}
      <Dialog open={editNameDialogOpen} onOpenChange={setEditNameDialogOpen}>
        <DialogContent className="w-[90%] max-w-sm mx-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-center">Editar Nome</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="h-12 rounded-xl text-base"
            />
            <Button onClick={updateListName} className="w-full h-12 rounded-xl">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteListDialogOpen} onOpenChange={setDeleteListDialogOpen}>
        <AlertDialogContent className="w-[90%] max-w-sm mx-auto rounded-2xl p-6">
          <AlertDialogHeader><AlertDialogTitle>Excluir Lista?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1 mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteList} className="flex-1 bg-destructive">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="w-[90%] max-w-sm mx-auto rounded-2xl p-6">
          <DialogHeader><DialogTitle>Duplicar Lista</DialogTitle></DialogHeader>
          <Input value={newListName} onChange={e => setNewListName(e.target.value)} className="h-12" />
          <Button onClick={duplicateList} className="w-full h-12">Confirmar</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={closeAddDialog}>
        <DialogContent className="w-[95%] max-w-sm mx-auto rounded-2xl h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
          {isProductMode ? (
            <>
              <DialogHeader className="p-4 pb-2 border-b border-border/50 bg-background z-10">
                <DialogTitle className="font-display text-xl flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 -ml-2"
                    onClick={() => setIsProductMode(null)}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  {isProductMode === "create"
                    ? "Novo Produto"
                    : "Editar Produto"}
                </DialogTitle>
              </DialogHeader>
              <div className="p-4 space-y-4 flex-1 bg-background">
                <div className="bg-primary/5 p-3 rounded-lg flex gap-3 text-sm text-primary/80 mb-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p>
                    Atenção: As alterações aqui são globais e afetam a busca de
                    todos os usuários.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Nome do Produto</Label>
                  <Input
                    value={editingProductData.name}
                    onChange={(e) =>
                      setEditingProductData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Ex: Arroz Branco"
                    className="h-12 rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    O sistema corrigirá automaticamente a ortografia.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Marca (Opcional)</Label>
                  <Input
                    value={editingProductData.brand}
                    onChange={(e) =>
                      setEditingProductData((prev) => ({
                        ...prev,
                        brand: e.target.value,
                      }))
                    }
                    placeholder="Ex: Tio João"
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Medida (Ex: 500g, 1L)</Label>
                  <Input
                    value={editingProductData.measurement}
                    onChange={(e) =>
                      setEditingProductData((prev) => ({
                        ...prev,
                        measurement: e.target.value,
                      }))
                    }
                    placeholder="Ex: 500g"
                    className="h-12 rounded-xl"
                  />
                </div>
              </div>
              <div className="p-4 border-t border-border bg-background z-10">
                <Button
                  onClick={handleCreateOrUpdateProduct}
                  className="w-full h-14 rounded-xl text-lg font-medium shadow-md"
                  disabled={
                    !editingProductData.name.trim() || validatingProduct
                  }
                >
                  {validatingProduct ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Validando...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" /> Salvar Produto
                    </>
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
              <div className="p-4 pb-2 bg-background z-10 space-y-3">
                {id && (
                  <div className="w-full">
                    <MagicPasteImport
                      listId={id}
                      onSuccess={() => {
                        fetchListData();
                        setAddDialogOpen(false);
                      }}
                    />
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 rounded-xl bg-secondary/50 border-transparent focus:bg-background focus:border-primary transition-all"
                  />
                </div>
              </div>
              {/* Conteúdo do modal de busca manual mantido funcional */}
              <div className="p-8 text-center text-muted-foreground">
                Use o chat na tela anterior para maior agilidade, ou busque aqui.
                <Button onClick={startCreateProduct} variant="outline" className="mt-4 w-full">Criar Novo</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <AlertDialogContent className="w-[90%] max-w-sm mx-auto rounded-2xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">Finalizar Compra</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3 mt-2">
                <p>
                  Os preços informados serão salvos e a lista será{" "}
                  <strong>fechada</strong>.
                </p>
                <div className="bg-muted/50 p-4 rounded-xl border border-border/50">
                  <p className="text-2xl font-bold text-foreground text-center">
                    R$ {totalPrice.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground text-center mt-1">
                    {
                      Object.keys(itemPrices).filter((k) => itemPrices[k] > 0)
                        .length
                    }{" "}
                    produtos com preço
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1 mt-0">Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={finishShopping} className="flex-1">Finalizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmUpdateDialogOpen} onOpenChange={setConfirmUpdateDialogOpen}>
        <AlertDialogContent className="w-[90%] max-w-sm mx-auto rounded-2xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl text-primary flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Economia Inteligente
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>Para garantir o preço total estimado, atualizaremos sua lista com as opções mais baratas encontradas neste mercado:</p>
              <div className="bg-muted/50 rounded-xl p-3 max-h-[40vh] overflow-y-auto space-y-3 text-sm">
                {substitutionsList.map((sub, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <span className="text-muted-foreground line-through text-xs break-words">{sub.original}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0 mx-auto" />
                    <span className="font-medium text-foreground text-right text-xs break-words">{sub.new}</span>
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 space-x-0 mt-4">
            <AlertDialogCancel disabled={startingShopping} className="flex-1 h-12 rounded-xl mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={proceedToStartShopping} disabled={startingShopping} className="flex-1 h-12 rounded-xl">Atualizar e Iniciar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReceiptReconciliation open={showReconciliation} onOpenChange={setShowReconciliation} scanResult={scanResult} currentItems={items.map((i) => ({ id: i.id, name: i.products.name, brand: i.products.brand }))} onConfirm={handleReconciliationConfirm} />
    </div>
  );
}
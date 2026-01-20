import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
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
  StopCircle,
  Globe,
  Share2,
  Scale,
  Search,
  Plus
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { MagicPasteImport } from "@/components/MagicPasteImport";

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

// Helper para timeout seguro
const safeInvoke = async <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (error) {
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
  user_id: string;
  is_public: boolean;
  forks_count: number;
  original_list_id: string | null;
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
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const routeMarketId = searchParams.get("marketId");
  const usePrices = searchParams.get("usePrices") === "true";
  const strategy = searchParams.get("strategy") || "cheapest";
  const isCompareMode = !!routeMarketId || (!!searchParams.get("marketId") && usePrices);

  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

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
  const [duplicating, setDuplicating] = useState(false);

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [addingProducts, setAddingProducts] = useState(false);
  const [isProductMode, setIsProductMode] = useState<"create" | "edit" | null>(null);
  const [editingProductData, setEditingProductData] = useState({ name: "", brand: "", measurement: "" });
  const [validatingProduct, setValidatingProduct] = useState(false);

  const [isShoppingMode, setIsShoppingMode] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [itemPrices, setItemPrices] = useState<ItemPrice>({});
  const [smartMatches, setSmartMatches] = useState<Record<string, SmartMatchDetail>>({});
  const [saving, setSaving] = useState(false);
  const [startingShopping, setStartingShopping] = useState(false);
  const [newListName, setNewListName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [isQRScanning, setIsQRScanning] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      const init = async () => {
        setLoading(true);
        await Promise.all([fetchListData(), fetchProducts()]);
        if (routeMarketId) await loadSmartMarketData(routeMarketId);
        setLoading(false);
      };
      init();
    }
  }, [user, id, routeMarketId]);

  useEffect(() => {
    const windowObj = window as unknown as IWindow;
    const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = "pt-BR";

      // Adicionado: Handler para quando o reconhecimento inicia
      recognitionRef.current.onstart = () => {
        setIsListening(true);
        toast({
          title: "Ouvindo...",
          className: "bg-red-500 text-white border-none duration-2000"
        });
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput((prev) => (prev ? `${prev}, ${transcript}` : transcript));
        setIsListening(false);
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const fetchListData = async () => {
    if (!id) return;
    try {
      const { data: listData, error: listError } = await supabase.from("shopping_lists").select("*").eq("id", id).single();
      if (listError) throw listError;

      setList(listData);
      setNewListName(`Cópia de ${listData.name}`);
      setEditingName(listData.name);
      setIsOwner(user?.id === listData.user_id);

      const { data: itemsData, error: itemsError } = await supabase
        .from("list_items")
        .select(`id, product_id, quantity, is_checked, products (id, name, brand, measurement)`)
        .eq("list_id", id)
        .order("created_at");

      if (itemsError) throw itemsError;
      // @ts-ignore
      setItems(itemsData || []);

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
      navigate('/listas');
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("id, name, brand, measurement").order("name").limit(200);
    if (data) setProducts(data);
  };

  const getOrCreateProduct = async (productName: string): Promise<string | null> => {
    const cleanName = productName.trim();
    const { data: existing } = await supabase.from('products').select('id').ilike('name', cleanName).is('brand', null).maybeSingle();
    if (existing) return existing.id;

    const { data: newProd, error } = await supabase.from('products').insert({ name: cleanName }).select('id').single();
    if (!error && newProd) return newProd.id;

    if (error && error.code === '23505') {
      const { data: retry } = await supabase.from('products').select('id').ilike('name', cleanName).maybeSingle();
      return retry?.id || null;
    }
    return null;
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !id) return;
    setIsProcessingChat(true);
    const textToSend = chatInput;
    setChatInput("");

    try {
      const { data, error } = await supabase.functions.invoke('parse-smart-list', { body: { text: textToSend } });

      let itemsToAdd = [];
      if (!error && data.items && data.items.length > 0) itemsToAdd = data.items;
      else itemsToAdd = [{ name: textToSend, quantity: 1 }];

      let addedCount = 0;
      for (const item of itemsToAdd) {
        const productId = await getOrCreateProduct(item.name);
        if (productId) {
          const { error: insertError } = await supabase.from('list_items').insert({ list_id: id, product_id: productId, quantity: item.quantity || 1, is_checked: false });
          if (!insertError) addedCount++;
        }
      }
      await fetchListData();
      toast({ title: `${addedCount} item(s) adicionado(s)!` });
    } catch (error) {
      toast({ title: "Erro ao adicionar", variant: "destructive" });
      setChatInput(textToSend);
    } finally {
      setIsProcessingChat(false);
    }
  };

  const loadSmartMarketData = async (targetMarketId: string) => {
    try {
      const { data: marketData } = await supabase.from("markets").select("*").eq("id", targetMarketId).single();
      if (marketData) setSelectedMarket(marketData);

      const { data, error } = await supabase.functions.invoke('smart-shopping-analysis', {
        body: { listId: id, targetMarketId: targetMarketId, strategy: strategy }
      });

      if (!error && data.results && data.results[0]) {
        const result = data.results[0];
        if (result.matches) {
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
      } else {
        loadMarketData(targetMarketId, false, true);
      }
    } catch (error) {
      loadMarketData(targetMarketId, false, true);
    }
  };

  const loadMarketData = async (targetMarketId: string, enableShoppingMode: boolean, shouldFetchPrices: boolean) => {
    const { data: market } = await supabase.from("markets").select("*").eq("id", targetMarketId).single();
    if (market) setSelectedMarket(market);

    if (shouldFetchPrices) {
      const { data: listItems } = await supabase.from("list_items").select("id, product_id").eq("list_id", id);
      if (listItems) {
        const pIds = listItems.map(i => i.product_id);
        const { data: prices } = await supabase.from('market_prices').select('product_id, price').eq('market_id', targetMarketId).in('product_id', pIds);

        const priceMap: ItemPrice = {};
        prices?.forEach(p => {
          const item = listItems.find(i => i.product_id === p.product_id);
          if (item) priceMap[item.id] = p.price;
        });
        setItemPrices(prev => ({ ...prev, ...priceMap }));
      }
    }
    if (enableShoppingMode) setIsShoppingMode(true);
  };

  const startShopping = async () => {
    if (!selectedMarket || !list) {
      toast({ title: "Selecione um mercado", variant: "destructive" });
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
        for (const [listItemId, match] of substitutions) {
          await supabase.from('list_items').update({ product_id: match.matchedProductId }).eq('id', listItemId);
        }
      }
      await supabase.from("shopping_lists").update({ status: "shopping", market_id: selectedMarket!.id }).eq("id", id!);
      setList(prev => prev ? { ...prev, status: "shopping", market_id: selectedMarket!.id } : null);
      setIsShoppingMode(true);

      if (isCompareMode) navigate(`/lista/${id}?usePrices=true`, { replace: true });

      toast({ title: "Compras iniciadas!", description: `Em ${selectedMarket?.name}` });
    } catch (error) {
      toast({ title: "Erro ao iniciar", variant: "destructive" });
    } finally {
      setStartingShopping(false);
      setConfirmUpdateDialogOpen(false);
    }
  };

  const cancelShopping = async () => {
    if (!id) return;
    try {
      await supabase.from("shopping_lists").update({ status: "open" }).eq("id", id);
      setList((prev) => (prev ? { ...prev, status: "open" } : null));
      setIsShoppingMode(false);
      setItemPrices({});
      localStorage.removeItem(`list_prices_${id}`);
    } catch (error) {
      console.error("Error cancelling shopping:", error);
      setIsShoppingMode(false);
    }
  };

  const finishShopping = async () => {
    if (!list || !selectedMarket) {
      toast({ title: "Erro de estado", description: "Mercado não selecionado.", variant: "destructive" });
      return;
    }

    // Filtra e limpa os dados antes de enviar
    const itemsWithPrices = items.filter(
      (item) => itemPrices[item.id] !== undefined && itemPrices[item.id] > 0
    );

    if (itemsWithPrices.length === 0) {
      toast({ title: "Nenhum preço", description: "Informe ao menos um preço.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Prepara payload de preços (limpo e tipado)
      const priceRecords = itemsWithPrices.map((item) => ({
        market_id: selectedMarket.id,
        product_id: item.product_id,
        price: Number(itemPrices[item.id]), // Garante que é número
      }));

      // 1. Salvar Preços (Batch Upsert - Mais seguro e evita erros 400)
      const { error: priceError } = await supabase
        .from('market_prices')
        .upsert(priceRecords, { onConflict: 'market_id, product_id' });

      if (priceError) throw priceError;

      // 2. Fechar Lista
      const { error: listError } = await supabase
        .from("shopping_lists")
        .update({ status: "closed", market_id: selectedMarket.id })
        .eq("id", id!);

      if (listError) throw listError;

      // --- CÁLCULO DE PONTOS ---
      const pointsPerItem = 5;
      const itemsCount = itemsWithPrices.length;
      const pointsFromItems = itemsCount * pointsPerItem;
      const pointsFromCheckout = 100;
      const totalPointsEarned = pointsFromCheckout + pointsFromItems;

      // 3. Pontos Globais (Rank Geral) - Com tratamento de erro isolado
      try {
        await supabase.rpc('add_points', {
          p_user_id: user!.id,
          p_points: totalPointsEarned,
          p_action: 'finish_shop',
          p_desc: `Finalizou compra com ${itemsCount} preços`
        });
      } catch (e) { console.error("Falha ao adicionar pontos globais", e); }

      // 4. Pontos de SOBERANIA (Rank do Mercado) - Com tratamento de erro isolado
      try {
        await supabase.rpc('add_market_points', {
          p_market_id: selectedMarket.id,
          p_user_id: user!.id,
          p_points: totalPointsEarned
        });
      } catch (e) { console.error("Falha ao adicionar pontos de mercado", e); }

      setList({ ...list, status: "closed", market_id: selectedMarket.id });
      setIsShoppingMode(false);
      setFinishDialogOpen(false);
      localStorage.removeItem(`list_prices_${id}`);

      toast({
        title: "Compra Finalizada! 🎉",
        description: `+${totalPointsEarned} PONTOS! (100 do checkout + ${pointsFromItems} pelos itens)`,
        className: "bg-yellow-50 border-yellow-200 text-yellow-900"
      });

      // Redirecionamento forçado para garantir que a rota existe
      window.location.href = '/';

    } catch (error: any) {
      console.error("Erro no checkout:", error);
      toast({
        title: "Erro ao finalizar",
        description: error.message || "Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublic = async (checked: boolean) => {
    if (!list || !isOwner) return;
    await supabase.from('shopping_lists').update({ is_public: checked }).eq('id', list.id);
    setList({ ...list, is_public: checked });
    toast({ title: checked ? "Lista Pública" : "Lista Privada" });
  };

  const handleCloneList = async () => {
    if (!list || !user || !newListName.trim()) {
      toast({ title: "Nome inválido", description: "O nome da lista não pode estar vazio.", variant: "destructive" });
      return;
    }

    setDuplicating(true);
    try {
      // 1. Criar nova lista
      const { data: newList, error } = await supabase.from("shopping_lists").insert({
        name: newListName.trim(),
        user_id: user.id,
        status: "open",
        original_list_id: list.id
      }).select().single();

      if (error) throw error;

      // 2. Clonar Itens
      const newItems = items.map(i => ({
        list_id: newList.id,
        product_id: i.product_id,
        quantity: i.quantity,
        is_checked: false
      }));

      if (newItems.length > 0) {
        await supabase.from("list_items").insert(newItems);
      }

      // 3. Incrementar Forks (Silencioso para não travar o fluxo)
      try {
        await supabase.rpc('increment_forks', { target_list_id: list.id });
      } catch (e) { console.warn("Forks count error ignored", e); }

      toast({ title: "Lista Clonada!" });

      // ORDEM IMPORTANTE: Fechar o modal ANTES de navegar
      setDuplicateDialogOpen(false);
      navigate(`/lista/${newList.id}`);

    } catch (e: any) {
      toast({ title: "Erro ao clonar", description: e.message, variant: "destructive" });
    } finally {
      setDuplicating(false);
    }
  };

  const toggleListening = () => { if (isListening) recognitionRef.current?.stop(); else recognitionRef.current?.start(); };
  const updateListName = async () => { await supabase.from("shopping_lists").update({ name: editingName }).eq("id", id!); setList(prev => prev ? { ...prev, name: editingName } : null); setEditNameDialogOpen(false); };
  const deleteList = async () => { await supabase.from("shopping_lists").delete().eq("id", id!); navigate("/listas"); };

  const toggleCheck = async (itemId: string) => {
    if (!isOwner && !isShoppingMode) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const newChecked = !item.is_checked;
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_checked: newChecked } : i));
    if (isOwner || isShoppingMode) await supabase.from("list_items").update({ is_checked: newChecked }).eq("id", itemId);
  };
  const removeItem = async (itemId: string) => {
    if (!isOwner) return;
    await supabase.from("list_items").delete().eq("id", itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  };
  const updatePrice = (itemId: string, val: number) => setItemPrices(prev => ({ ...prev, [itemId]: val }));

  const closeAddDialog = (open: boolean) => {
    if (!open) { setSelectedProducts(new Set()); setSearchQuery(""); setIsProductMode(null); }
    setAddDialogOpen(open);
  };
  const handleCreateOrUpdateProduct = async () => { /* Placeholder */ };
  const handleFileUpload = async (e: any) => { /* Placeholder */ };

  if (authLoading || loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!list) return null;

  const totalPrice = Object.values(itemPrices).reduce((a, b) => a + b, 0);
  const isClosed = list.status === 'closed';

  const isSimpleMode = !isShoppingMode && !isClosed && !isCompareMode;

  const filteredListItems = items.filter((item) => {
    if (!listFilter.trim()) return true;
    const lowerFilter = listFilter.toLowerCase();
    const productName = item.products.name.toLowerCase();
    const productBrand = item.products.brand?.toLowerCase() || "";
    return productName.includes(lowerFilter) || productBrand.includes(lowerFilter);
  });

  return (
    <div className={cn("min-h-screen bg-background transition-all", items.length > 0 ? "pb-48" : "pb-20")}>
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-lg border-b border-border transition-all">
        <div className="flex items-center gap-2 px-4 py-3 max-w-md mx-auto">
          <Button variant="ghost" size="icon" onClick={() => isCompareMode ? navigate(-1) : navigate("/listas")} className="h-10 w-10 -ml-2 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0 flex flex-col justify-center h-10">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-display font-bold text-foreground truncate">{list.name}</h1>
              {list.is_public && <Globe className="w-3 h-3 text-indigo-500" />}
              {!isOwner && <Lock className="w-3 h-3 text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {(isShoppingMode || isCompareMode) && selectedMarket ?
                <span className={cn("font-bold flex items-center gap-1", isCompareMode ? "text-indigo-600" : "text-green-600")}>
                  <Store className="w-3 h-3" /> {isCompareMode ? `Preços em ${selectedMarket.name}` : `Comprando em ${selectedMarket.name}`}
                </span> :
                isOwner ? `${items.length} itens • ${list.forks_count || 0} cópias` : `Modo Leitura`
              }
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isOwner && !isCompareMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9"><MoreVertical className="w-5 h-5 text-muted-foreground" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl">
                  <div className="px-2 py-2 flex items-center justify-between"><Label className="text-xs font-semibold">Lista Pública</Label><Switch checked={list.is_public} onCheckedChange={handleTogglePublic} /></div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setEditNameDialogOpen(true)}><Pencil className="w-4 h-4 mr-2" /> Renomear</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(window.location.href); toast({ title: "Link copiado!" }); }}><Share2 className="w-4 h-4 mr-2" /> Compartilhar</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setDeleteListDialogOpen(true)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Excluir Lista</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <AppMenu />
          </div>
        </div>
        {!isOwner && !isCompareMode && (
          <div className="bg-indigo-50 px-4 py-3 flex items-center justify-between border-b border-indigo-100 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-indigo-700 text-sm font-medium"><Sparkles className="w-4 h-4 fill-indigo-200" /><span>Gostou dessa lista?</span></div>
            <Button size="sm" onClick={handleCloneList} disabled={duplicating} className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 rounded-lg shadow-sm">{duplicating ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Copy className="w-3 h-3 mr-1.5" /> Copiar para mim</>}</Button>
          </div>
        )}
        {totalPrice > 0 && (
          <div className={cn("px-4 py-2 text-center border-b backdrop-blur-sm transition-colors", isCompareMode ? "bg-indigo-50/80 border-indigo-100" : "bg-green-50/80 border-green-100")}>
            <span className={cn("text-xs font-bold uppercase tracking-wider", isCompareMode ? "text-indigo-700" : "text-green-700")}>Total Estimado</span>
            <p className={cn("text-lg font-bold", isCompareMode ? "text-indigo-800" : "text-green-800")}>R$ {totalPrice.toFixed(2)}</p>
          </div>
        )}
      </header>

      <main className="px-4 py-4 max-w-md mx-auto">
        {!isShoppingMode && !isCompareMode && !isClosed && isOwner && items.length > 0 && (
          <div className="mb-6 animate-fade-in">
            <p className="text-sm text-muted-foreground mb-2 ml-1">Onde você vai fazer as compras?</p>
            <MarketSelector selectedMarket={selectedMarket} onSelectMarket={setSelectedMarket} />
          </div>
        )}
        {items.length === 0 ? (
          <EmptyState icon={<Sparkles className="w-10 h-10 text-primary" />} title={isOwner ? "Sua lista está vazia" : "Lista vazia"} description="Adicione itens." action={null} />
        ) : (
          <div className={cn("space-y-3", (!isOwner && !isCompareMode) && "opacity-90")}>
            {items.length > 5 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar na lista..." className="pl-9 pr-9 h-10 rounded-xl bg-secondary/30 border-transparent focus:bg-background" value={listFilter} onChange={(e) => setListFilter(e.target.value)} />
                {listFilter && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent text-muted-foreground" onClick={() => setListFilter("")}><X className="w-4 h-4" /></Button>}
              </div>
            )}

            {filteredListItems.map((item) => {
              const match = isCompareMode ? smartMatches[item.id] : null;
              const displayName = match ? match.matchedProductName : item.products.name;
              const displayBrand = match ? (match.matchedProductBrand || "") : (item.products.brand || "");
              return (
                <div key={item.id} className="flex flex-col mb-2">
                  <div className="relative z-10">
                    <ProductItem id={item.id} name={displayName} brand={displayBrand} measurement={item.products.measurement} quantity={item.quantity} isChecked={item.is_checked} price={itemPrices[item.id] || 0} showPriceInput={isShoppingMode} readonly={(!isOwner && !isShoppingMode) || isCompareMode} isSimpleMode={isSimpleMode} onToggleCheck={toggleCheck} onUpdateQuantity={() => { }} onUpdatePrice={updatePrice} onUpdateBrand={() => { }} onRemove={removeItem} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {isOwner && !isShoppingMode && !isCompareMode && !isClosed && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-background border-t border-border z-50 safe-bottom">
          <div className="max-w-md mx-auto">
            <div className="flex gap-2 items-center mb-3">
              <Button variant={isListening ? "destructive" : "secondary"} size="icon" className={cn("h-12 w-12 rounded-full shrink-0 shadow-sm", isListening && "animate-pulse")} onClick={toggleListening}>{isListening ? <StopCircle className="w-6 h-6" /> : <Mic className="w-6 h-6" />}</Button>
              <div className="flex-1 relative">
                <Input placeholder={isListening ? "Ouvindo..." : "Ex: Arroz, Feijão, Leite..."} value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} className="h-12 rounded-full pl-5 pr-12 bg-secondary/20" disabled={isProcessingChat} />
                <Button size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full" onClick={handleSendMessage} disabled={!chatInput.trim() || isProcessingChat}>{isProcessingChat ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</Button>
              </div>
            </div>
            {items.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => navigate(`/comparar/${id}`)} variant="outline" className="h-12 rounded-xl"><Scale className="w-5 h-5 mr-2" /> Comparar</Button>
                <Button onClick={startShopping} className="h-12 rounded-xl shadow-lg" disabled={!selectedMarket || startingShopping}>{startingShopping ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShoppingCart className="w-5 h-5 mr-2" /> Iniciar</>}</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {isCompareMode && items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-xl border-t border-border z-50 safe-bottom">
          <div className="max-w-md mx-auto flex gap-3">
            <Button onClick={() => navigate(-1)} variant="outline" className="flex-1 h-14 rounded-xl"><ArrowLeft className="w-5 h-5 mr-2" /> Voltar</Button>
            <Button onClick={startShopping} className="flex-1 h-14 rounded-xl shadow-lg shadow-indigo-200 bg-indigo-600 hover:bg-indigo-700 text-white" disabled={startingShopping}>
              {startingShopping ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShoppingCart className="w-5 h-5 mr-2" /> Usar essa lista</>}
            </Button>
          </div>
        </div>
      )}

      {isShoppingMode && !isClosed && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border z-50 safe-bottom">
          <div className="max-w-md mx-auto flex gap-3">
            <Button variant="outline" onClick={cancelShopping} className="w-14 h-14 rounded-xl shrink-0"><X className="w-6 h-6" /></Button>
            <Button onClick={() => setFinishDialogOpen(true)} className="flex-1 h-14 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200"><Check className="w-5 h-5 mr-2" /> Finalizar & Ganhar Pontos</Button>
          </div>
        </div>
      )}

      {isClosed && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border z-50 safe-bottom">
          <div className="max-w-md mx-auto">
            <Button onClick={() => setDuplicateDialogOpen(true)} className="w-full h-14 rounded-xl text-lg font-medium shadow-lg" size="lg"><Copy className="w-5 h-5 mr-2" /> Utilizar Novamente</Button>
          </div>
        </div>
      )}

      <Dialog open={editNameDialogOpen} onOpenChange={setEditNameDialogOpen}>
        <DialogContent className="w-[90%] max-w-sm rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>Renomear</DialogTitle>
            <DialogDescription className="sr-only">Altere o nome da sua lista</DialogDescription>
          </DialogHeader>
          <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-12 rounded-xl" />
          <Button onClick={updateListName} className="w-full h-12 rounded-xl mt-2">Salvar</Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteListDialogOpen} onOpenChange={setDeleteListDialogOpen}>
        <AlertDialogContent className="w-[90%] max-w-sm rounded-2xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            <AlertDialogCancel className="flex-1 mt-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteList} className="flex-1 bg-destructive">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <AlertDialogContent className="w-[90%] max-w-sm rounded-2xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Compra?</AlertDialogTitle>
            <AlertDialogDescription>Isso vai fechar a lista e gerar seus pontos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 mt-4">
            <AlertDialogCancel className="flex-1 mt-0 h-12 rounded-xl">Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={finishShopping} className="flex-1 h-12 rounded-xl bg-green-600">Finalizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmUpdateDialogOpen} onOpenChange={setConfirmUpdateDialogOpen}>
        <AlertDialogContent className="w-[90%] max-w-sm rounded-2xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-600" /> Atualizar Lista?</AlertDialogTitle>
            <AlertDialogDescription>
              Para garantir o preço estimado, vamos atualizar sua lista para usar as marcas encontradas neste mercado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 mt-4">
            <AlertDialogCancel className="flex-1 mt-0 h-12 rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={proceedToStartShopping} className="flex-1 h-12 rounded-xl bg-indigo-600">Aceitar e Iniciar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="w-[90%] max-w-sm rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>Duplicar Lista</DialogTitle>
            <DialogDescription className="sr-only">Crie uma cópia da sua lista</DialogDescription>
          </DialogHeader>
          <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} className="h-12 rounded-xl" />
          <Button onClick={handleCloneList} className="w-full h-12 rounded-xl mt-2" disabled={duplicating}>
            {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={closeAddDialog}>
        <DialogContent className="w-[95%] max-w-sm mx-auto rounded-2xl h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-2 border-b border-border/50 bg-background z-10">
            <DialogTitle className="font-display text-xl">Adicionar Produtos</DialogTitle>
            <DialogDescription className="sr-only">Busque ou adicione produtos à sua lista</DialogDescription>
          </DialogHeader>
          <div className="p-4 pb-2 bg-background z-10 space-y-3">
            <div className="w-full"><MagicPasteImport listId={id!} onSuccess={() => { fetchListData(); setAddDialogOpen(false); }} /></div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 rounded-xl bg-secondary/50 border-transparent focus:bg-background focus:border-primary transition-all" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
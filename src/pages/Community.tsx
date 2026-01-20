import { useEffect, useState, useRef } from "react";
import {
    MapPin,
    Loader2,
    Plus,
    ThumbsUp,
    AlertTriangle,
    TrendingDown,
    Clock,
    Store,
    MessageCircle,
    Trash2,
    Send,
    X,
    ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppMenu } from "@/components/AppMenu";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 99999;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

interface Comment {
    id: string;
    content: string;
    created_at: string;
    profiles: {
        display_name: string;
        avatar_url: string;
    };
}

interface PriceAlert {
    id: string;
    product_name: string;
    price: number;
    market_id: string;
    user_id: string;
    created_at: string;
    upvotes: number;
    is_verified: boolean;
    markets: {
        name: string;
        latitude: number;
        longitude: number;
    } | null;
    profiles?: {
        display_name: string;
        avatar_url: string;
    } | null;
    distance?: number;
    has_liked?: boolean;
    comments_count?: number;
}

interface MarketSimple {
    id: string;
    name: string;
}

export default function Community() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [alerts, setAlerts] = useState<PriceAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [markets, setMarkets] = useState<MarketSimple[]>([]);
    const [activeFilter, setActiveFilter] = useState<'recent' | 'cheap' | 'nearest'>('recent');
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newProductName, setNewProductName] = useState("");
    const [newPrice, setNewPrice] = useState("");
    const [selectedMarketId, setSelectedMarketId] = useState("");
    const [isPosting, setIsPosting] = useState(false);

    const [activeAlertForComments, setActiveAlertForComments] = useState<PriceAlert | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [loadingComments, setLoadingComments] = useState(false);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    const [alertToDelete, setAlertToDelete] = useState<string | null>(null);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.error("Erro GPS", err)
            );
        }
    }, []);

    useEffect(() => {
        fetchAlerts();
        fetchMarkets();
    }, [activeFilter, userLocation]);

    useEffect(() => {
        if (commentsEndRef.current) {
            commentsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [comments]);

    const fetchAlerts = async () => {
        // CORREÇÃO CRÍTICA DO FLASH:
        // Só define loading=true se a lista estiver VAZIA.
        // Se já tiver dados, ele atualiza em "background" sem limpar a tela.
        if (alerts.length === 0) setLoading(true);

        try {
            let query = supabase
                .from('price_alerts')
                .select(`
                    *,
                    markets (name, latitude, longitude),
                    profiles:user_id (display_name, avatar_url),
                    alert_comments (count)
                `);

            if (activeFilter === 'recent') {
                query = query.order('created_at', { ascending: false });
            } else if (activeFilter === 'cheap') {
                query = query.order('price', { ascending: true });
            }

            const { data: alertsData, error } = await query.limit(50);
            if (error) throw error;

            let myLikes = new Set<string>();
            if (user) {
                const { data: likesData } = await supabase
                    .from('alert_confirmations')
                    .select('alert_id')
                    .eq('user_id', user.id);
                likesData?.forEach(l => myLikes.add(l.alert_id));
            }

            let processedAlerts = alertsData.map((a: any) => {
                const dist = (userLocation && a.markets)
                    ? calculateDistance(userLocation.lat, userLocation.lng, a.markets.latitude, a.markets.longitude)
                    : 999;

                return {
                    ...a,
                    distance: dist,
                    has_liked: myLikes.has(a.id),
                    comments_count: a.alert_comments?.[0]?.count || 0
                };
            });

            if (activeFilter === 'nearest') {
                processedAlerts.sort((a, b) => (a.distance || 999) - (b.distance || 999));
            }

            setAlerts(processedAlerts);
        } catch (error) {
            console.error("Erro ao carregar alertas:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMarkets = async () => {
        const { data } = await supabase.from('markets').select('id, name').order('name');
        setMarkets(data || []);
    };

    const handleCreateAlert = async () => {
        if (!newProductName || !newPrice || !selectedMarketId) return;
        setIsPosting(true);

        try {
            const priceValue = parseFloat(newPrice.replace(',', '.'));

            const { error } = await supabase.from('price_alerts').insert({
                user_id: user!.id,
                market_id: selectedMarketId,
                product_name: newProductName,
                price: priceValue,
                upvotes: 0,
                is_verified: false
            });

            if (error) throw error;

            await supabase.rpc('add_points', {
                p_user_id: user!.id,
                p_points: 5,
                p_action: 'alert_create',
                p_desc: `Alertou preço de ${newProductName}`
            });

            toast({
                title: "Alerta enviado!",
                description: "+5 pontos! Ganhe mais se alguém confirmar.",
                className: "bg-green-50 border-green-200"
            });

            setIsCreateOpen(false);
            setNewProductName("");
            setNewPrice("");
            setSelectedMarketId("");
            fetchAlerts();

        } catch (error) {
            toast({ title: "Erro ao criar alerta", variant: "destructive" });
        } finally {
            setIsPosting(false);
        }
    };

    const handleConfirmOffer = async (alert: PriceAlert) => {
        if (alert.has_liked) return;

        const MAX_DISTANCE_KM = 0.1; // 100m

        if (!userLocation || !alert.markets) {
            toast({ title: "Localização indisponível", description: "Ative o GPS para confirmar ofertas.", variant: "destructive" });
            return;
        }

        const dist = calculateDistance(userLocation.lat, userLocation.lng, alert.markets.latitude, alert.markets.longitude);

        if (dist > MAX_DISTANCE_KM) {
            toast({
                title: "Muito longe!",
                description: `Você precisa estar no local para confirmar (Distância: ${(dist * 1000).toFixed(0)}m).`,
                variant: "destructive"
            });
            return;
        }

        setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, upvotes: a.upvotes + 1, has_liked: true } : a));

        try {
            const { error } = await supabase.from('alert_confirmations').insert({
                user_id: user!.id,
                alert_id: alert.id
            });
            if (error) throw error;

            await supabase.rpc('add_points', {
                p_user_id: user!.id,
                p_points: 10,
                p_action: 'alert_confirm',
                p_desc: `Confirmou oferta: ${alert.product_name}`
            });

            toast({ title: "Oferta confirmada!", description: "+10 pontos garantidos!", className: "bg-green-50 border-green-200" });
        } catch (err) {
            setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, upvotes: a.upvotes - 1, has_liked: false } : a));
            toast({ title: "Erro ao confirmar", variant: "destructive" });
        }
    };

    const confirmDelete = (alertId: string) => {
        setAlertToDelete(alertId);
    };

    const handleDeleteAlert = async () => {
        if (!alertToDelete) return;
        const alertId = alertToDelete;
        setAlertToDelete(null);

        const backupAlerts = [...alerts];
        setAlerts(prev => prev.filter(a => a.id !== alertId));

        try {
            const { error } = await supabase.from('price_alerts').delete().eq('id', alertId);
            if (error) throw error;
            toast({ title: "Post apagado." });
        } catch (error) {
            setAlerts(backupAlerts);
            toast({ title: "Erro ao apagar", description: "Verifique se você é o dono.", variant: "destructive" });
        }
    };

    const openComments = async (alert: PriceAlert) => {
        setActiveAlertForComments(alert);
        setLoadingComments(true);
        try {
            const { data } = await supabase
                .from('alert_comments')
                .select(`id, content, created_at, profiles(display_name, avatar_url)`)
                .eq('alert_id', alert.id)
                .order('created_at', { ascending: true });

            // @ts-ignore
            setComments(data || []);
        } finally {
            setLoadingComments(false);
        }
    };

    const handleSendComment = async () => {
        if (!newComment.trim() || !activeAlertForComments) return;
        try {
            const { error } = await supabase.from('alert_comments').insert({
                user_id: user!.id,
                alert_id: activeAlertForComments.id,
                content: newComment.trim()
            });
            if (error) throw error;

            setNewComment("");
            openComments(activeAlertForComments);
            setAlerts(prev => prev.map(a => a.id === activeAlertForComments.id ? { ...a, comments_count: (a.comments_count || 0) + 1 } : a));

        } catch (error) {
            toast({ title: "Erro ao comentar", variant: "destructive" });
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-24 font-sans">
            <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="px-5 py-3 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            Comunidade
                        </h1>
                        <p className="text-xs text-muted-foreground">Oportunidades reais</p>
                    </div>
                    <AppMenu />
                </div>
            </header>

            <main className="pt-20 px-4 space-y-4 max-w-lg mx-auto">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <Badge
                        variant="outline"
                        onClick={() => setActiveFilter('nearest')}
                        className={cn(
                            "px-3 py-1.5 h-auto text-xs gap-1 cursor-pointer transition-colors rounded-full",
                            activeFilter === 'nearest' ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-gray-200 hover:bg-gray-50"
                        )}
                    >
                        <MapPin className="w-3 h-3" /> Mais Próximos
                    </Badge>
                    <Badge
                        variant="outline"
                        onClick={() => setActiveFilter('recent')}
                        className={cn(
                            "px-3 py-1.5 h-auto text-xs gap-1 cursor-pointer transition-colors rounded-full",
                            activeFilter === 'recent' ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 hover:bg-gray-50"
                        )}
                    >
                        <Clock className="w-3 h-3" /> Recentes
                    </Badge>
                    <Badge
                        variant="outline"
                        onClick={() => setActiveFilter('cheap')}
                        className={cn(
                            "px-3 py-1.5 h-auto text-xs gap-1 cursor-pointer transition-colors rounded-full",
                            activeFilter === 'cheap' ? "bg-green-50 border-green-200 text-green-700" : "bg-white border-gray-200 hover:bg-gray-50"
                        )}
                    >
                        <TrendingDown className="w-3 h-3" /> Mais Baratos
                    </Badge>
                </div>

                {loading && alerts.length === 0 ? (
                    <div className="flex justify-center pt-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : alerts.length === 0 ? (
                    <div className="text-center py-20 px-6">
                        <div className="bg-yellow-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-yellow-500" />
                        </div>
                        <h3 className="text-gray-900 font-bold mb-1">Sem alertas aqui</h3>
                        <p className="text-gray-500 text-sm">Seja o primeiro a reportar uma oferta!</p>
                    </div>
                ) : (
                    alerts.map((alert) => (
                        <Card key={alert.id} className="border-none shadow-sm shadow-indigo-100 rounded-2xl overflow-hidden bg-white animate-in fade-in slide-in-from-bottom-2">
                            <div className="p-4 flex gap-4">
                                <div className="flex flex-col items-center justify-center bg-green-50 w-20 h-20 rounded-xl shrink-0 border border-green-100">
                                    <span className="text-xs text-green-600 font-medium">R$</span>
                                    <span className="text-xl font-bold text-green-700 tracking-tighter">
                                        {Math.floor(alert.price)}
                                        <span className="text-sm">,{(alert.price % 1).toFixed(2).substring(2)}</span>
                                    </span>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-gray-900 truncate text-base pr-6">{alert.product_name}</h3>
                                        {user?.id === alert.user_id && (
                                            <button onClick={(e) => { e.stopPropagation(); confirmDelete(alert.id); }} className="text-gray-300 hover:text-red-500 -mt-1 -mr-1 p-1 z-10 relative">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div
                                        className="flex items-center gap-1.5 mt-1 text-xs font-medium text-gray-600 cursor-pointer hover:text-indigo-600 transition-colors group"
                                        onClick={() => navigate(`/ver-mercado/${alert.market_id}`)}
                                    >
                                        <Store className="w-3.5 h-3.5 text-indigo-500" />
                                        <span className="truncate group-hover:underline">{alert.markets?.name || "Mercado desconhecido"}</span>
                                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />

                                        {alert.distance !== undefined && alert.distance < 50 && (
                                            <span className="text-gray-400 no-underline">• {alert.distance < 1 ? `${(alert.distance * 1000).toFixed(0)}m` : `${alert.distance.toFixed(1)}km`}</span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="w-5 h-5 border border-gray-100">
                                                <AvatarImage src={alert.profiles?.avatar_url || undefined} />
                                                <AvatarFallback className="text-[9px]">{alert.profiles?.display_name?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-[10px] text-gray-400">
                                                há {formatDistanceToNow(new Date(alert.created_at), { locale: ptBR })}
                                            </span>
                                        </div>

                                        <div className="flex gap-2">
                                            <Sheet>
                                                <SheetTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => openComments(alert)}
                                                        className="h-7 px-2 text-xs text-gray-400 hover:text-indigo-600 gap-1"
                                                    >
                                                        <MessageCircle className="w-3.5 h-3.5" />
                                                        {alert.comments_count || 0}
                                                    </Button>
                                                </SheetTrigger>
                                                <SheetContent side="bottom" className="h-[85vh] rounded-t-[2rem] p-0 flex flex-col bg-gray-50/95 backdrop-blur-sm">
                                                    <SheetHeader className="p-5 border-b border-gray-100 bg-white rounded-t-[2rem]">
                                                        <SheetTitle className="text-lg flex items-center gap-2">
                                                            <MessageCircle className="w-5 h-5 text-indigo-500" />
                                                            Comentários
                                                        </SheetTitle>
                                                        <p className="text-xs text-gray-500 font-normal truncate">
                                                            Sobre <strong>{activeAlertForComments?.product_name}</strong> em {activeAlertForComments?.markets?.name}
                                                        </p>
                                                    </SheetHeader>

                                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                                        {loadingComments ? (
                                                            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
                                                        ) : comments.length === 0 ? (
                                                            <div className="text-center py-10 space-y-2">
                                                                <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                                                                    <MessageCircle className="w-6 h-6 text-gray-400" />
                                                                </div>
                                                                <p className="text-sm text-gray-500">Nenhum comentário ainda.<br />Seja o primeiro!</p>
                                                            </div>
                                                        ) : (
                                                            comments.map(c => (
                                                                <div key={c.id} className="flex gap-3 animate-fade-in">
                                                                    <Avatar className="w-8 h-8 shrink-0 border border-white shadow-sm">
                                                                        <AvatarImage src={c.profiles.avatar_url} />
                                                                        <AvatarFallback>{c.profiles.display_name[0]}</AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="flex flex-col gap-1 max-w-[85%]">
                                                                        <div className="bg-white rounded-2xl rounded-tl-none px-4 py-2.5 shadow-sm border border-gray-100">
                                                                            <p className="text-xs font-bold text-gray-900 mb-0.5">{c.profiles.display_name}</p>
                                                                            <p className="text-sm text-gray-700 leading-relaxed break-words">{c.content}</p>
                                                                        </div>
                                                                        <span className="text-[10px] text-gray-400 pl-2">{formatDistanceToNow(new Date(c.created_at), { locale: ptBR, addSuffix: true })}</span>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                        <div ref={commentsEndRef} />
                                                    </div>

                                                    <div className="p-3 bg-white border-t border-gray-100 safe-bottom">
                                                        <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                                                            <Textarea
                                                                placeholder="Escreva um comentário..."
                                                                value={newComment}
                                                                onChange={e => setNewComment(e.target.value)}
                                                                className="min-h-[40px] max-h-[100px] bg-transparent border-none shadow-none focus-visible:ring-0 resize-none text-sm py-2.5"
                                                            />
                                                            <Button
                                                                size="icon"
                                                                onClick={handleSendComment}
                                                                disabled={!newComment.trim()}
                                                                className="h-9 w-9 rounded-full shrink-0 mb-0.5 bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-50 disabled:bg-gray-300"
                                                            >
                                                                <Send className="w-4 h-4 ml-0.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </SheetContent>
                                            </Sheet>

                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleConfirmOffer(alert)}
                                                className={cn(
                                                    "h-7 px-2 text-xs gap-1.5 transition-colors",
                                                    alert.has_liked
                                                        ? "bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-800"
                                                        : "bg-gray-50 text-gray-500 hover:bg-green-50 hover:text-green-600"
                                                )}
                                                disabled={alert.has_liked}
                                            >
                                                <ThumbsUp className={cn("w-3.5 h-3.5", alert.has_liked && "fill-current")} />
                                                {alert.has_liked ? "Confirmado" : "Confirmar"}
                                                <span className="ml-0.5 font-bold">{alert.upvotes > 0 && alert.upvotes}</span>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </main>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                    <Button className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-xl bg-yellow-500 hover:bg-yellow-600 text-white transition-all hover:scale-105 active:scale-95 flex items-center justify-center z-30">
                        <Plus className="w-7 h-7" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="w-[90%] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                            Novo Alerta
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Produto</label>
                            <Input placeholder="Ex: Picanha Friboi" value={newProductName} onChange={e => setNewProductName(e.target.value)} className="h-11" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Preço (R$)</label>
                                <Input placeholder="0,00" type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="h-11 font-bold text-green-700" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Mercado</label>
                                <Select onValueChange={setSelectedMarketId}>
                                    <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {markets.map(m => (
                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Button
                            className="w-full h-12 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl mt-2"
                            onClick={handleCreateAlert}
                            disabled={isPosting || !newProductName || !newPrice || !selectedMarketId}
                        >
                            {isPosting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Publicar Alerta"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* AVISO DE 48H AO DELETAR */}
            <AlertDialog open={!!alertToDelete} onOpenChange={(open) => !open && setAlertToDelete(null)}>
                <AlertDialogContent className="rounded-2xl w-[90%]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apagar Alerta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se este post tiver menos de 48 horas, você <strong>perderá os 5 pontos</strong> ganhos ao criá-lo.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row gap-2">
                        <AlertDialogCancel className="flex-1 mt-0">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAlert} className="flex-1 bg-red-500 hover:bg-red-600">
                            Apagar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
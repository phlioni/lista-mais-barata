import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, OverlayView } from "@react-google-maps/api";
import {
    Trophy,
    Target,
    Flame,
    Loader2,
    Gift,
    MapPin,
    ChevronRight,
    ShieldAlert,
    TrendingUp,
    AlertTriangle,
    Crown,
    X,
    Info,
    Swords,
    Radar,
    ListChecks,
    User,
    Ghost,
    Crosshair,
    Shield,
    ShoppingBasket, // Usado para a Cesta da Vizinhança
    HeartCrack,
    Mic,
    Square,
    Medal,
    Package
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppMenu } from "@/components/AppMenu";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

// --- CONFIGURAÇÃO DO MAPA (DARK MODE) ---
const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#1e293b" }] }, // Slate-800
    { elementType: "labels.text.stroke", stylers: [{ color: "#1e293b" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] }, // Slate-400
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] }, // Slate-700
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#475569" }] }, // Slate-600
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] }, // Slate-900
    { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const mapContainerStyle = { width: '100%', height: '100%' };

// --- CORREÇÃO 1: Função de offset estática ---
const getPixelPositionOffset = (width: number, height: number) => ({ x: 0, y: 0 });
const getPlayerPixelOffset = (width: number, height: number) => ({ x: -20, y: -20 });

// --- Interfaces ---
interface MarketPinData {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    sovereign: {
        id: string | null;
        name: string;
        avatar: string | null;
        score: number;
    };
    myScore: number;
    status: 'sovereign' | 'hostile' | 'neutral';
}

interface LeaderboardItem {
    user_id: string;
    display_name: string;
    avatar_url?: string;
    total_points: number;
    my_rank: number;
}

interface Mission {
    id: string;
    title: string;
    description: string;
    reward_points: number;
    action_link: string;
    icon: string;
}

interface QuickAlert {
    id: string;
    product_name: string;
    price: number;
    market_name: string;
    created_at: string;
}

interface NotificationItem {
    id: string;
    title: string;
    message: string;
    type: 'warning' | 'alert' | 'info';
    read: boolean;
}

interface Territory {
    market_id: string;
    score: number;
    market_name: string;
    is_current_sovereign: boolean;
}

interface SupplyDropItem {
    product_id: string;
    product_name: string;
    popularity: number;
}

// --- Componente: Marcador do Mapa ---
const GamificationMarker = ({ pin, onClick }: { pin: MarketPinData, onClick: () => void }) => {
    const isMe = pin.status === 'sovereign';
    const isHostile = pin.status === 'hostile';

    let colorClass = isMe ? "border-yellow-500 shadow-yellow-500/50" : isHostile ? "border-rose-500 shadow-rose-500/50" : "border-slate-400 shadow-slate-500/50";
    let icon = isMe ? <Crown className="w-3 h-3 text-yellow-500" /> : isHostile ? <User className="w-3 h-3 text-rose-500" /> : <Crosshair className="w-3 h-3 text-slate-400" />;

    return (
        <div className="absolute -translate-x-1/2 -translate-y-full cursor-pointer group z-10 hover:z-50" onClick={(e) => { e.stopPropagation(); onClick(); }}>
            {/* Avatar/Icone do Pin */}
            <div className={cn("w-8 h-8 rounded-full border-2 bg-slate-900 flex items-center justify-center shadow-lg transition-transform group-hover:scale-125", colorClass)}>
                {isHostile && pin.sovereign.avatar ? (
                    <img src={pin.sovereign.avatar} className="w-full h-full rounded-full object-cover" />
                ) : icon}
            </div>
            {/* Triângulo Base */}
            <div className={cn("w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] absolute left-1/2 -translate-x-1/2 -bottom-1.5", isMe ? "border-t-yellow-500" : isHostile ? "border-t-rose-500" : "border-t-slate-400")}></div>
        </div>
    );
};

export default function Gamification() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";
    const { isLoaded, loadError } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: apiKey });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [loading, setLoading] = useState(true);

    // Dados Gamificação
    const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
    const [myPoints, setMyPoints] = useState(0);
    const [myRank, setMyRank] = useState<number>(0);
    const [alerts, setAlerts] = useState<QuickAlert[]>([]);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [marketPins, setMarketPins] = useState<MarketPinData[]>([]);

    // Cesta da Vizinhança (Antigo Supply Drop)
    const [hasActiveList, setHasActiveList] = useState(true);
    const [supplyDropOpen, setSupplyDropOpen] = useState(false);
    const [supplyItems, setSupplyItems] = useState<SupplyDropItem[]>([]);
    const [claimingSupply, setClaimingSupply] = useState(false);

    // UI
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedMarket, setSelectedMarket] = useState<MarketPinData | null>(null);

    // --- LÓGICA DO RÁDIO DE MISSÃO ---
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessingAudio, setIsProcessingAudio] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    const onLoad = useCallback((map: google.maps.Map) => setMap(map), []);
    const onUnmount = useCallback(() => setMap(null), []);

    const mapOptions = useMemo(() => ({
        styles: darkMapStyle,
        disableDefaultUI: true, // Remove UI padrão
        clickableIcons: false,
        zoomControl: false,
        keyboardShortcuts: false, // Remove "Keyboard shortcuts"
        gestureHandling: "greedy",
        backgroundColor: "#1e293b"
    }), []);

    // Geolocalização
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => setUserLocation({ lat: -23.5505, lng: -46.6333 }) // Fallback SP
            );
        }
    }, []);

    // Carregar Dados
    useEffect(() => {
        if (!authLoading && !user) navigate("/auth");
        if (user) loadData();
    }, [user, authLoading, navigate]);

    const loadData = async () => {
        if (leaderboard.length === 0) setLoading(true);
        try {
            const [rankingResult, pointsResult, alertsResult, missionsResult, notifsResult, territoriesResult, marketsResult, scoresResult, activeListsResult] = await Promise.all([
                supabase.rpc('get_monthly_leaderboard'),
                supabase.rpc('get_my_monthly_points', { target_user_id: user!.id }),
                supabase.from('price_alerts').select('id, product_name, price, created_at, markets(name)').order('created_at', { ascending: false }).limit(3),
                supabase.from('missions').select('*').eq('is_active', true),
                supabase.from('notifications').select('*').eq('user_id', user!.id).eq('read', false).order('created_at', { ascending: false }),
                supabase.from('market_scores').select('market_id, score, markets(name)').eq('user_id', user!.id).gt('score', 0).order('score', { ascending: false }),
                supabase.from('markets').select('id, name, latitude, longitude'),
                supabase.from('market_scores').select('market_id, score, user_id, profiles(display_name, avatar_url)').order('score', { ascending: false }),
                supabase.from('shopping_lists').select('id').eq('user_id', user!.id).eq('status', 'open').limit(1)
            ]);

            // Checar se tem lista ativa (Para exibir a Cesta da Vizinhança)
            setHasActiveList(activeListsResult.data && activeListsResult.data.length > 0 ? true : false);

            // Processar Ranking e Pontos
            if (rankingResult.data) {
                // @ts-ignore
                setLeaderboard(rankingResult.data || []);
                // @ts-ignore
                const me = rankingResult.data.find((r: any) => r.user_id === user!.id);
                if (me) setMyRank(me.my_rank);
            }
            setMyPoints(pointsResult.data || 0);

            // Processar Pins do Mapa
            if (marketsResult.data && scoresResult.data) {
                // @ts-ignore
                const pins: MarketPinData[] = marketsResult.data.map((m: any) => {
                    // @ts-ignore
                    const marketScores = scoresResult.data.filter((s: any) => s.market_id === m.id);
                    const leader = marketScores[0];
                    // @ts-ignore
                    const myScoreEntry = marketScores.find((s: any) => s.user_id === user!.id);
                    const myScore = myScoreEntry ? myScoreEntry.score : 0;

                    let status: MarketPinData['status'] = 'neutral';
                    if (leader) status = leader.user_id === user!.id ? 'sovereign' : 'hostile';

                    return {
                        id: m.id,
                        name: m.name,
                        latitude: m.latitude,
                        longitude: m.longitude,
                        sovereign: {
                            id: leader?.user_id || null,
                            name: leader?.profiles?.display_name || "Ninguém",
                            avatar: leader?.profiles?.avatar_url || null,
                            score: leader?.score || 0
                        },
                        myScore: myScore,
                        status: status
                    };
                });
                setMarketPins(pins);

                // --- MODIFICAÇÃO: Lógica para identificar território perdido ---
                // @ts-ignore
                const processedTerritories = territoriesResult.data.map((t: any) => {
                    // @ts-ignore
                    const marketScores = scoresResult.data.filter((s: any) => s.market_id === t.market_id);
                    const currentLeader = marketScores[0];

                    // Se o líder atual for eu, sou soberano. Se não, perdi o reinado.
                    const isSovereign = currentLeader?.user_id === user!.id;

                    return {
                        market_id: t.market_id,
                        score: t.score,
                        market_name: t.markets?.name,
                        is_current_sovereign: isSovereign
                    };
                });
                setTerritories(processedTerritories);
            }

            // Processar Outros Dados
            // @ts-ignore
            if (alertsResult.data) setAlerts(alertsResult.data.map((a: any) => ({ id: a.id, product_name: a.product_name, price: a.price, market_name: a.markets?.name || 'Mercado', created_at: a.created_at })) || []);
            // @ts-ignore
            if (missionsResult.data) setMissions(missionsResult.data || []);
            // @ts-ignore
            if (notifsResult.data) setNotifications(notifsResult.data || []);

        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        await supabase.from('notifications').update({ read: true }).eq('id', id);
    };

    // --- CESTA DA VIZINHANÇA (Antigo Supply Drop) ---
    const handleOpenSupplyDrop = async () => {
        setSupplyDropOpen(true);
        if (supplyItems.length > 0) return;

        if (userLocation) {
            // Chama a RPC que criamos (agora com calculate_distance funcionando)
            const { data, error } = await supabase.rpc('get_regional_trends', {
                user_lat: userLocation.lat,
                user_lon: userLocation.lng,
                radius_km: 10
            });

            if (data) {
                // @ts-ignore
                setSupplyItems(data);
            }
        }
    };

    const handleClaimSupplyDrop = async () => {
        if (!user || supplyItems.length === 0) return;
        setClaimingSupply(true);

        try {
            // 1. Criar Lista
            const now = new Date();
            const listName = `Cesta da Vizinhança ${now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;

            const { data: newList, error: listError } = await supabase
                .from('shopping_lists')
                .insert({ name: listName, user_id: user.id, status: 'open' })
                .select()
                .single();

            if (listError) throw listError;

            // 2. Inserir Itens
            const itemsToInsert = supplyItems.map(item => ({
                list_id: newList.id,
                product_id: item.product_id,
                quantity: 1,
                is_checked: false
            }));

            const { error: itemsError } = await supabase.from('list_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;

            toast({
                title: "Lista Criada com Sucesso! 🛒",
                description: `${itemsToInsert.length} itens adicionados baseados na comunidade.`,
                className: "bg-green-600 text-white border-none"
            });

            setSupplyDropOpen(false);
            navigate(`/lista/${newList.id}`);

        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao criar lista", variant: "destructive" });
        } finally {
            setClaimingSupply(false);
        }
    };

    // --- HANDLERS DE GRAVAÇÃO (RÁDIO DE MISSÃO) ---
    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream; // Salva para matar depois

            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = handleProcessRecording;
            recorder.start();
            setIsRecording(true);

            // Feedback tátil
            if (navigator.vibrate) navigator.vibrate(50);

        } catch (error) {
            console.error("Erro ao acessar microfone:", error);
            toast({
                title: "Permissão Necessária",
                description: "Precisamos do microfone para ouvir sua lista.",
                variant: "destructive"
            });
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (navigator.vibrate) navigator.vibrate([50, 50, 50]);

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        }
    };

    const handleProcessRecording = async () => {
        if (audioChunksRef.current.length === 0) return;
        setIsProcessingAudio(true);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];

            try {
                toast({ title: "Ouvindo...", description: "Processando seus itens." });

                // 1. Transcrever (Whisper)
                const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke('transcribe-audio', {
                    body: { audioBase64: base64Audio }
                });

                if (transcriptError) throw transcriptError;
                if (!transcriptData.text) throw new Error("Não entendi o que foi falado.");

                const text = transcriptData.text;
                toast({ title: "Entendido!", description: `Criando lista com: "${text.substring(0, 20)}..."` });

                // 2. Estruturar Lista (GPT-4o)
                const { data: aiData, error: aiError } = await supabase.functions.invoke('parse-smart-list', {
                    body: { text }
                });

                if (aiError) throw aiError;
                if (!aiData.items || aiData.items.length === 0) throw new Error("Nenhum item identificado.");

                // 3. Criar a Lista no Banco (Com hora para evitar duplicidade)
                const now = new Date();
                const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const listName = `Lista de Voz ${now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${timeStr}`;

                const { data: newList, error: createListError } = await supabase
                    .from('shopping_lists')
                    .insert({ name: listName, user_id: user!.id, status: 'open' })
                    .select()
                    .single();

                if (createListError) throw createListError;

                // 4. Match & Insert Items (RPC)
                const { data: processedItems, error: dbError } = await supabase
                    .rpc('match_and_create_products', {
                        items_in: aiData.items
                    });

                if (dbError) throw dbError;

                // 5. Inserir Itens na Lista (Fallback quantity = 1)
                const listItemsToInsert = (processedItems as any[]).map(item => ({
                    list_id: newList.id,
                    product_id: item.product_id,
                    quantity: item.quantity || 1,
                    is_checked: false
                }));

                const { error: insertError } = await supabase
                    .from('list_items')
                    .insert(listItemsToInsert);

                if (insertError) throw insertError;

                toast({
                    title: "Lista Pronta!",
                    description: `${listItemsToInsert.length} itens adicionados.`,
                    className: "bg-green-600 text-white border-none"
                });

                navigate(`/lista/${newList.id}`);

            } catch (error: any) {
                console.error("Erro na missão de voz:", error);
                toast({
                    title: "Não entendi",
                    description: "Tente falar um pouco mais devagar.",
                    variant: "destructive"
                });
            } finally {
                setIsProcessingAudio(false);
            }
        };
    };

    if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

    const topThree = leaderboard.slice(0, 3);
    const restOfRanking = leaderboard.slice(3, 10);

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            {/* CSS: Remoção de Legendas + Efeito de Card Quebrado + Animação Gravação + Float */}
            <style>
                {`
                    .gmnoprint a, .gmnoprint span, .gm-style-cc {
                        display: none !important;
                    }
                    .gmnoprint div {
                        background: none !important;
                    }
                    a[href^="http://maps.google.com/maps"] {
                        display: none !important;
                    }
                    a[href^="https://maps.google.com/maps"] {
                        display: none !important;
                    }
                    .gm-bundled-control .gmnoprint {
                        display: block !important;
                    }
                    
                    /* EFEITO DE "CARD QUEBRADO" PARA TERRITÓRIOS PERDIDOS */
                    .card-broken {
                        position: relative;
                        overflow: hidden;
                        background-color: theme('colors.red.50');
                        border-color: theme('colors.red.300') !important;
                        box-shadow: inset 0 4px 6px -1px rgb(0 0 0 / 0.1), inset 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
                    }
                    .card-broken::before {
                        content: '';
                        position: absolute;
                        top: -20%;
                        left: -20%;
                        width: 140%;
                        height: 140%;
                        background: linear-gradient(135deg, transparent 48%, theme('colors.red.900') 48%, theme('colors.red.900') 52%, transparent 52%);
                        opacity: 0.15;
                        pointer-events: none;
                        transition: all 0.3s ease;
                    }
                    .card-broken::after {
                         content: '';
                         position: absolute;
                         top: 40%;
                         left: -20%;
                         width: 150%;
                         height: 2px;
                         background: theme('colors.red.800');
                         opacity: 0.2;
                         transform: rotate(-25deg);
                         pointer-events: none;
                    }
                    .card-broken:hover::before, .card-broken:hover::after {
                        opacity: 0.3;
                        transform: scale(1.02) rotate(1deg);
                    }

                    /* ANIMAÇÃO DE PULSO PARA GRAVAÇÃO */
                    @keyframes pulse-ring {
                        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                        70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
                        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                    }
                    .recording-active { animation: pulse-ring 2s infinite; }

                    /* ANIMAÇÃO FLUTUANTE PARA CESTA DA VIZINHANÇA */
                    @keyframes float {
                        0% { transform: translateY(0px) translateX(-50%); }
                        50% { transform: translateY(-10px) translateX(-50%); }
                        100% { transform: translateY(0px) translateX(-50%); }
                    }
                    .animate-float { animation: float 3s ease-in-out infinite; }
                `}
            </style>

            {/* Header Simples */}
            <header className="px-6 pt-6 pb-2 bg-white sticky top-0 z-30 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-display font-bold text-gray-900 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        Arena de Pontos
                    </h1>
                    <AppMenu />
                </div>
            </header>

            <main className="px-4 pt-6 space-y-6">

                {/* 1. CARD PRINCIPAL: MAPA TÁTICO & STATUS */}
                <div className="relative rounded-3xl overflow-hidden bg-slate-900 text-white shadow-xl h-80 border border-slate-800">

                    {/* Header de Status (Sobreposto ao Mapa) */}
                    <div className="absolute top-0 left-0 right-0 p-5 z-20 bg-gradient-to-b from-slate-950/90 to-transparent pointer-events-none">
                        <div className="flex justify-between items-start">
                            <div className="pointer-events-auto">
                                <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> Sua Pontuação</p>
                                <h2 className="text-4xl font-display font-bold text-yellow-400 drop-shadow-md">{myPoints}</h2>
                            </div>
                            <div className="text-right pointer-events-auto">
                                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-lg">
                                    <Trophy className="w-3 h-3 text-yellow-400" />
                                    <span className="text-sm font-bold">#{myRank || '-'}</span>
                                </div>
                                {/* Botão de Regras */}
                                <div className="mt-2">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <button className="text-[10px] text-slate-300 underline hover:text-white flex items-center justify-end gap-1 w-full bg-black/40 px-2 py-1 rounded-md">
                                                <Info className="w-3 h-3" /> Regras
                                            </button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader><DialogTitle>Tabela de Pontuação</DialogTitle></DialogHeader>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow><TableHead>Ação</TableHead><TableHead className="text-right">Pts</TableHead></TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    <TableRow><TableCell>Finalizar Lista</TableCell><TableCell className="text-right font-bold text-green-600">+100</TableCell></TableRow>
                                                    <TableRow><TableCell>Cadastrar Preço</TableCell><TableCell className="text-right font-bold text-blue-600">+5</TableCell></TableRow>
                                                    <TableRow><TableCell>Validar Oferta</TableCell><TableCell className="text-right font-bold text-yellow-600">+10</TableCell></TableRow>
                                                </TableBody>
                                            </Table>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* GOOGLE MAPS REAL */}
                    <div className="h-full w-full bg-slate-800">
                        {isLoaded ? (
                            <GoogleMap
                                mapContainerStyle={mapContainerStyle}
                                center={userLocation || { lat: -23.5505, lng: -46.6333 }}
                                zoom={14}
                                onLoad={onLoad}
                                onUnmount={onUnmount}
                                options={mapOptions} // Usa os estilos ESCUROS definidos
                            >
                                {/* Radar do Jogador */}
                                {userLocation && (
                                    <OverlayView position={userLocation} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET} getPixelPositionOffset={(w, h) => ({ x: -20, y: -20 })}>
                                        <div className="relative w-10 h-10 flex items-center justify-center pointer-events-none">
                                            <div className="absolute w-[200%] h-[200%] border border-green-500/30 rounded-full animate-ping"></div>
                                            <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-[0_0_15px_#22c55e] z-10"></div>
                                        </div>
                                    </OverlayView>
                                )}

                                {/* --- CESTA DA VIZINHANÇA INTEGRADA AO MAPA --- */}
                                {!hasActiveList && userLocation && !loading && (
                                    <OverlayView
                                        position={userLocation}
                                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                                        getPixelPositionOffset={() => ({ x: 0, y: -80 })} // Flutua ACIMA do usuário
                                    >
                                        <div
                                            className="cursor-pointer animate-float group"
                                            onClick={handleOpenSupplyDrop}
                                        >
                                            <div className="flex flex-col items-center">
                                                <div className="bg-sky-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full mb-1 shadow-lg border border-white/20 whitespace-nowrap animate-bounce">
                                                    CESTA POPULAR
                                                </div>
                                                <div className="bg-gradient-to-b from-sky-400 to-blue-600 p-2.5 rounded-xl shadow-2xl border-2 border-white relative hover:scale-110 transition-transform">
                                                    <ShoppingBasket className="w-6 h-6 text-white" />
                                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white animate-pulse"></div>
                                                </div>
                                                {/* Corda/Seta visual */}
                                                <div className="w-0.5 h-4 bg-white/50 -mt-1"></div>
                                            </div>
                                        </div>
                                    </OverlayView>
                                )}

                                {/* Pins dos Mercados */}
                                {marketPins.map(pin => (
                                    <OverlayView key={pin.id} position={{ lat: pin.latitude, lng: pin.longitude }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET} getPixelPositionOffset={(w, h) => ({ x: 0, y: 0 })}>
                                        <GamificationMarker pin={pin} onClick={() => setSelectedMarket(pin)} />
                                    </OverlayView>
                                ))}
                            </GoogleMap>
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-500">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. MEUS TERRITÓRIOS (SCROLL HORIZONTAL) - MODIFICADO */}
                {territories.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <Crown className="w-5 h-5 text-yellow-600 fill-yellow-600" />
                            <h3 className="font-bold text-gray-900">Domínios Conquistados</h3>
                        </div>

                        <div className="flex overflow-x-auto gap-3 pb-4 -mx-4 px-4 snap-x no-scrollbar">
                            {territories.map(t => (
                                <div
                                    key={t.market_id}
                                    onClick={() => navigate(`/ver-mercado/${t.market_id}`)}
                                    className={cn(
                                        "snap-center shrink-0 w-28 h-28 rounded-2xl flex flex-col items-center justify-center p-2 text-center relative overflow-hidden group cursor-pointer transition-all border shadow-sm",
                                        t.is_current_sovereign
                                            ? "bg-white border-yellow-200 hover:border-yellow-400 hover:shadow-md"
                                            : "card-broken" // Aplica o estilo de vidro quebrado
                                    )}
                                >
                                    {/* Badge Superior Ajustada (Top 1 / Perdido) */}
                                    <div className={cn(
                                        "absolute top-1 right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-bl-lg z-10",
                                        t.is_current_sovereign ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                                    )}>
                                        {t.is_current_sovereign ? "TOP 1" : "PERDIDO"}
                                    </div>

                                    {/* Icone Central */}
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-sm border relative z-10",
                                        t.is_current_sovereign
                                            ? "bg-gradient-to-br from-yellow-100 to-white border-yellow-50"
                                            : "bg-red-100/80 border-red-200"
                                    )}>
                                        {t.is_current_sovereign ? (
                                            <Crown className="w-5 h-5 text-yellow-600" />
                                        ) : (
                                            <HeartCrack className="w-5 h-5 text-red-600 drop-shadow-sm" />
                                        )}
                                    </div>

                                    <h4 className={cn("font-bold text-[10px] line-clamp-2 leading-tight mb-1 relative z-10", t.is_current_sovereign ? "text-gray-800" : "text-red-950")}>
                                        {t.market_name}
                                    </h4>
                                    <span className={cn("text-[9px] font-mono px-1.5 rounded relative z-10", t.is_current_sovereign ? "text-gray-500 bg-gray-50" : "text-red-700 bg-red-200/50 font-bold")}>
                                        {t.score} pts
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 3. VALIDAR OFERTAS */}
                <section>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-red-500" />
                            <h3 className="font-bold text-gray-900">Alertas de Preço</h3>
                        </div>
                        <Button variant="link" className="text-xs h-auto p-0 text-slate-500" onClick={() => navigate('/comunidade')}>Ver todos</Button>
                    </div>
                    <div className="space-y-2">
                        {alerts.length > 0 ? (
                            alerts.map(alert => (
                                <div key={alert.id} onClick={() => navigate('/comunidade')} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 active:scale-98 transition-transform shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 font-bold text-[10px] border border-red-100">R$</div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 line-clamp-1">{alert.product_name}</p>
                                            <p className="text-[10px] text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {alert.market_name}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 text-[10px] whitespace-nowrap">+10 pts</Badge>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-xs text-gray-400 py-6 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                <ShieldAlert className="w-6 h-6 mx-auto mb-2 opacity-20" />
                                Sem alertas pendentes na sua região.
                            </div>
                        )}
                    </div>
                </section>

                {/* 4. MISSÕES ATIVAS */}
                <section>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-bold text-gray-900">Missões Prioritárias</h3>
                        </div>
                    </div>
                    <div className="grid gap-3">
                        {loading && missions.length === 0 ? (
                            <div className="h-20 w-full bg-gray-200 rounded-2xl animate-pulse" />
                        ) : (
                            missions.map((mission) => (
                                <div key={mission.id} onClick={() => navigate(mission.action_link)} className="bg-gradient-to-r from-indigo-50 to-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex items-center gap-4 cursor-pointer active:scale-98 transition-transform group">
                                    <div className="w-10 h-10 rounded-full bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                                        {mission.icon === 'cart' ? <ListChecks className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-sm text-gray-900">{mission.title}</h4>
                                        <p className="text-xs text-gray-500 line-clamp-1">{mission.description}</p>
                                    </div>
                                    <Badge className="bg-indigo-600 text-white border-none shadow-md whitespace-nowrap">+{mission.reward_points}</Badge>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* 5. RANKING (CLEAN) */}
                <section className="pb-6">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <Flame className="w-5 h-5 text-gray-400" />
                        <h3 className="font-bold text-gray-600 text-sm uppercase tracking-wide">Ranking Global</h3>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                        {leaderboard.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {leaderboard.slice(0, 5).map((player, idx) => (
                                    <div key={player.user_id} className={cn("flex items-center justify-between p-3", player.user_id === user?.id ? "bg-blue-50/50" : "")}>
                                        <div className="flex items-center gap-3">
                                            <span className={cn("font-bold w-4 text-center text-xs", idx < 3 ? "text-gray-900" : "text-gray-400")}>{idx + 1}</span>
                                            <Avatar className="w-8 h-8 border border-gray-100 overflow-hidden">
                                                <AvatarImage src={player.avatar_url} className="w-full h-full object-cover" />
                                                <AvatarFallback className="text-xs bg-gray-100 text-gray-500">{player.display_name?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className={cn("text-xs font-medium truncate max-w-[140px]", player.user_id === user?.id ? "text-blue-700 font-bold" : "text-gray-600")}>
                                                {player.display_name} {player.user_id === user?.id && "(Eu)"}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold text-gray-500 font-mono">{player.total_points}</span>
                                    </div>
                                ))}
                                <div className="p-2 text-center bg-gray-50/50">
                                    <Button variant="ghost" size="sm" className="text-[10px] text-gray-400 h-6 w-full hover:bg-transparent hover:text-gray-600">Ver ranking completo</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 text-center text-gray-400 text-xs">Carregando ranking...</div>
                        )}
                    </div>
                </section>

            </main>

            {/* --- BOTÃO DE AÇÃO PRINCIPAL (RÁDIO DE MISSÃO) --- */}
            <div className="fixed bottom-24 left-4 right-4 z-40 flex justify-center">
                <Button
                    className={cn(
                        "h-16 w-full max-w-sm rounded-full shadow-xl transition-all duration-300 flex items-center justify-center gap-3 border-4",
                        isRecording
                            ? "bg-red-500 hover:bg-red-600 border-red-200 recording-active"
                            : isProcessingAudio
                                ? "bg-indigo-600 border-indigo-200 opacity-90"
                                : "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 border-white text-slate-900"
                    )}
                    onPointerDown={handleStartRecording}
                    onPointerUp={handleStopRecording}
                    onPointerLeave={handleStopRecording}
                    disabled={isProcessingAudio}
                >
                    {isProcessingAudio ? (
                        <>
                            <Loader2 className="w-6 h-6 animate-spin text-white" />
                            <span className="text-white font-bold uppercase tracking-wide">Criando Lista...</span>
                        </>
                    ) : isRecording ? (
                        <>
                            <Square className="w-6 h-6 fill-white text-white" />
                            <span className="text-white font-bold uppercase tracking-wide">Solte para Enviar</span>
                        </>
                    ) : (
                        <>
                            <Mic className="w-6 h-6" />
                            <div className="flex flex-col items-start leading-none">
                                <span className="font-bold text-sm uppercase tracking-wider">Segure para Falar</span>
                                <span className="text-[10px] opacity-80 font-medium">Crie sua lista por voz</span>
                            </div>
                        </>
                    )}
                </Button>
            </div>

            {/* DIALOG DA CESTA DA VIZINHANÇA (ANTIGO SUPPLY DROP) */}
            <Dialog open={supplyDropOpen} onOpenChange={setSupplyDropOpen}>
                <DialogContent className="max-w-xs rounded-2xl p-0 overflow-hidden bg-slate-900 text-white border-slate-700">
                    <div className="bg-gradient-to-br from-sky-500 to-blue-700 p-6 flex flex-col items-center justify-center">
                        <ShoppingBasket className="w-16 h-16 text-white mb-2 animate-bounce" />
                        <DialogTitle className="text-xl font-bold font-display text-center text-white">Cesta da Vizinhança</DialogTitle>
                        <DialogDescription className="text-sky-100 text-center text-xs">
                            Estes são os produtos mais comprados pelas pessoas aqui perto.
                        </DialogDescription>
                    </div>

                    <div className="p-4 max-h-[40vh] overflow-y-auto">
                        {supplyItems.length > 0 ? (
                            <div className="space-y-2">
                                {supplyItems.map((item) => (
                                    <div key={item.product_id} className="flex items-center justify-between p-2 bg-slate-800 rounded-lg border border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <Package className="w-4 h-4 text-sky-400" />
                                            <span className="text-sm font-medium">{item.product_name}</span>
                                        </div>
                                        <Badge variant="secondary" className="bg-slate-700 text-slate-300 text-[10px]">{item.popularity} compras</Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-4 text-slate-400 gap-2">
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <span className="text-xs">Buscando itens populares...</span>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-4 bg-slate-950 border-t border-slate-800">
                        <Button
                            className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold h-12"
                            onClick={handleClaimSupplyDrop}
                            disabled={supplyItems.length === 0 || claimingSupply}
                        >
                            {claimingSupply ? <Loader2 className="w-5 h-5 animate-spin" /> : "ADICIONAR À MINHA LISTA"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* SHEET DE DETALHES DO MAPA (PAINEL TÁTICO) */}
            <Sheet open={!!selectedMarket} onOpenChange={(open) => !open && setSelectedMarket(null)}>
                <SheetContent side="bottom" className="rounded-t-3xl border-t border-slate-800 bg-slate-900 p-0 text-white z-[60]">
                    <SheetHeader className="sr-only"><SheetTitle>Detalhes da Arena</SheetTitle></SheetHeader>
                    {selectedMarket && (
                        <>
                            <div className={cn("h-24 w-full relative overflow-hidden rounded-t-3xl bg-gradient-to-b from-indigo-900/40 to-slate-900")}>
                                <div className="absolute top-4 left-6 z-10">
                                    <h2 className="text-xl font-bold text-white drop-shadow-md">{selectedMarket.name}</h2>
                                    <div className="flex items-center gap-2 mt-1"><MapPin className="w-3 h-3 text-slate-400" /><span className="text-xs text-slate-300">Mercado Local</span></div>
                                </div>
                                <div className="absolute right-4 top-4">
                                    {selectedMarket.status === 'sovereign' && <Badge className="bg-yellow-500 text-black border-none font-bold">DOMINADO</Badge>}
                                    {selectedMarket.status === 'hostile' && <Badge className="bg-rose-600 text-white border-none">HOSTIL</Badge>}
                                    {selectedMarket.status === 'neutral' && <Badge variant="outline" className="text-cyan-400 border-cyan-600">NEUTRO</Badge>}
                                </div>
                            </div>
                            <div className="px-6 pb-8 -mt-6 relative z-20">
                                <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl flex items-center justify-between shadow-xl mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            {selectedMarket.status === 'neutral' ? (
                                                <div className="w-12 h-12 border-2 border-slate-600 rounded-full flex items-center justify-center bg-slate-700"><Ghost className="w-6 h-6 text-slate-500" /></div>
                                            ) : (
                                                <Avatar className={cn("w-12 h-12 border-2", selectedMarket.status === 'sovereign' ? "border-yellow-500" : "border-rose-600")}>
                                                    <AvatarImage src={selectedMarket.sovereign.avatar || ""} />
                                                    <AvatarFallback>S</AvatarFallback>
                                                </Avatar>
                                            )}
                                            {selectedMarket.status !== 'neutral' && <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5"><Crown className={cn("w-3 h-3", selectedMarket.status === 'sovereign' ? "text-yellow-500" : "text-rose-500")} /></div>}
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Soberano Atual</p>
                                            <p className="text-sm font-bold text-white">{selectedMarket.sovereign.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Pontos</p>
                                        <p className="text-lg font-mono font-bold text-indigo-400">{selectedMarket.sovereign.score}</p>
                                    </div>
                                </div>
                                <Button className={cn("w-full h-14 text-lg font-bold rounded-2xl shadow-lg transition-transform active:scale-95", selectedMarket.status === 'sovereign' ? "bg-yellow-500 hover:bg-yellow-400 text-black" : "bg-indigo-600 hover:bg-indigo-500 text-white")} onClick={() => navigate(`/lista/nova`)}>
                                    {selectedMarket.status === 'sovereign' ? <><Shield className="w-5 h-5 mr-2" /> MANTER DOMÍNIO</> : <><Swords className="w-5 h-5 mr-2" /> ATACAR AGORA</>}
                                </Button>
                                <p className="text-center text-[10px] text-slate-500 mt-3">Criar uma lista neste mercado rende +100 pontos.</p>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
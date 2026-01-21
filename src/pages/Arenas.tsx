import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, OverlayView } from "@react-google-maps/api";
import {
    Trophy,
    Loader2,
    Crown,
    Swords,
    Shield,
    MapPin,
    Ghost,
    Navigation,
    User,
    Crosshair,
    ArrowLeft // Importado ArrowLeft
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppMenu } from "@/components/AppMenu";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";

// --- ESTILO DO MAPA (Dark Mode / Identity Match) ---
const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#020617" }] }, // Slate-950 (Fundo)
    { elementType: "labels.text.stroke", stylers: [{ color: "#020617" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] }, // Slate-400 (Texto)
    {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#cbd5e1" }],
    },
    {
        featureType: "poi",
        stylers: [{ visibility: "off" }], // Remove pontos de interesse padrões
    },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#1e293b" }], // Slate-800 (Ruas)
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#0f172a" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#334155" }], // Slate-700
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#0f172a" }], // Slate-900
    },
    {
        featureType: "transit",
        stylers: [{ visibility: "off" }],
    },
];

const mapContainerStyle = { width: '100%', height: '100%' };

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

// --- Componente: Marcador Personalizado (O Pin no Mapa) ---
const ArenaMarker = ({ pin, onClick }: { pin: MarketPinData, onClick: () => void }) => {
    const isMe = pin.status === 'sovereign';
    const isHostile = pin.status === 'hostile';
    const isNeutral = pin.status === 'neutral';

    // Cores baseadas no status (CORRIGIDO PARA ALTO CONTRASTE)
    let colorClass = "";
    let pulseClass = "";
    let iconColor = "";

    if (isMe) {
        colorClass = "border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.6)]";
        pulseClass = "bg-yellow-500";
        iconColor = "text-yellow-500";
    } else if (isHostile) {
        colorClass = "border-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.6)]";
        pulseClass = "bg-rose-600";
        iconColor = "text-rose-500";
    } else {
        // Neutro agora é CIANO para brilhar no escuro
        colorClass = "border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)]";
        pulseClass = "bg-cyan-400";
        iconColor = "text-cyan-400";
    }

    return (
        <div
            className="absolute -translate-x-1/2 -translate-y-full cursor-pointer group z-10 hover:z-50 transition-all"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
            {/* Etiqueta Flutuante (Nome do Mercado) */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] font-bold px-2 py-1 rounded-md border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {pin.name}
            </div>

            {/* Ícone de Coroa Flutuante (Se for Soberano ou Hostil) */}
            {(isMe || isHostile) && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 animate-bounce">
                    <Crown className={cn("w-5 h-5 drop-shadow-md", isMe ? "text-yellow-400 fill-yellow-400" : "text-rose-500 fill-rose-500")} />
                </div>
            )}

            {/* O Pin (Avatar ou Ícone) */}
            <div className={cn("w-12 h-12 rounded-full border-[3px] bg-slate-950 overflow-hidden relative transition-transform group-hover:scale-110 flex items-center justify-center", colorClass)}>
                {isNeutral ? (
                    <Crosshair className="w-6 h-6 text-cyan-400 animate-pulse" />
                ) : (
                    <Avatar className="w-full h-full">
                        <AvatarImage src={pin.sovereign.avatar || ""} className="object-cover" />
                        <AvatarFallback className="bg-slate-900 flex items-center justify-center w-full h-full">
                            <User className={cn("w-6 h-6", iconColor)} />
                        </AvatarFallback>
                    </Avatar>
                )}
            </div>

            {/* Triângulo do Pin (Seta) */}
            <div className={cn("w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] absolute left-1/2 -translate-x-1/2 -bottom-2",
                isMe ? "border-t-yellow-500" : isHostile ? "border-t-rose-600" : "border-t-cyan-400"
            )}></div>

            {/* Base Pulsante (Chão) */}
            <div className={cn("absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-3 rounded-[100%] blur-sm opacity-60 animate-pulse", pulseClass)}></div>
        </div>
    );
};

// --- Tela Principal ---
export default function Arenas() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    // Google Maps Key
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";
    const { isLoaded, loadError } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: apiKey });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [loading, setLoading] = useState(true);

    // Estados de Dados
    const [myPoints, setMyPoints] = useState(0);
    const [marketPins, setMarketPins] = useState<MarketPinData[]>([]);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    // Estado de Seleção (Para o Sheet)
    const [selectedMarket, setSelectedMarket] = useState<MarketPinData | null>(null);

    const onLoad = useCallback((map: google.maps.Map) => setMap(map), []);
    const onUnmount = useCallback(() => setMap(null), []);

    // 1. Geolocalização
    useEffect(() => {
        if (!navigator.geolocation) {
            setUserLocation({ lat: -23.5505, lng: -46.6333 });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setUserLocation({ lat: -23.5505, lng: -46.6333 })
        );
    }, []);

    // 2. Carregar Dados
    useEffect(() => {
        if (!authLoading && !user) navigate("/auth");
        if (user) loadData();
    }, [user, authLoading, navigate]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Pontos do Usuário
            const { data: points } = await supabase.rpc('get_my_monthly_points', { target_user_id: user!.id });
            setMyPoints(points || 0);

            // Carregar Mercados e Scores Globais
            const { data: markets } = await supabase.from('markets').select('id, name, latitude, longitude');
            const { data: scores } = await supabase.from('market_scores')
                .select('market_id, score, user_id, profiles(display_name, avatar_url)')
                .order('score', { ascending: false });

            if (markets && scores) {
                const pins: MarketPinData[] = markets.map(m => {
                    const marketScores = scores.filter(s => s.market_id === m.id);
                    const leader = marketScores[0];

                    const myScoreEntry = marketScores.find(s => s.user_id === user!.id);
                    const myScore = myScoreEntry ? myScoreEntry.score : 0;

                    let status: MarketPinData['status'] = 'neutral';
                    if (leader) {
                        status = leader.user_id === user!.id ? 'sovereign' : 'hostile';
                    }

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
            }
        } catch (error) {
            console.error("Erro ao carregar arenas:", error);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-white" /></div>;
    if (loadError) return <div className="p-8 bg-slate-950 text-rose-500">Erro Maps: Verifique sua API Key.</div>;
    if (!isLoaded) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-white" /></div>;

    return (
        <div className="h-[100dvh] w-full relative bg-slate-950 overflow-hidden font-sans">

            {/* Header Flutuante (Status & Voltar) */}
            <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-start pointer-events-none">

                {/* 1. MELHORIA: Botão VOLTAR e Status Agrupados */}
                <div className="flex gap-2 pointer-events-auto">
                    <Button
                        size="icon"
                        variant="secondary"
                        className="rounded-full bg-slate-900/90 text-white border border-slate-700 hover:bg-slate-800 shadow-xl w-10 h-10"
                        onClick={() => navigate(-1)} // Ação de voltar
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>

                    <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 shadow-xl flex items-center gap-2 text-white animate-in slide-in-from-top">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span className="font-display font-bold tracking-wide text-sm">{myPoints} pts</span>
                    </div>
                </div>

                {/* Botão de Recentralizar (Mantido na direita) */}
                <Button
                    size="icon"
                    variant="outline"
                    className="pointer-events-auto rounded-full bg-slate-950/80 border-slate-800 text-white hover:bg-slate-900 shadow-xl"
                    onClick={() => {
                        if (map && userLocation) {
                            map.panTo(userLocation);
                            map.setZoom(15);
                        }
                    }}
                >
                    <Navigation className="w-4 h-4" />
                </Button>
            </div>

            {/* O MAPA */}
            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={userLocation || { lat: -23.5505, lng: -46.6333 }}
                zoom={15}
                onLoad={onLoad}
                onUnmount={onUnmount}
                options={{
                    styles: darkMapStyle,
                    disableDefaultUI: true, // Mapa limpo
                    clickableIcons: false,
                    zoomControl: false,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    gestureHandling: "greedy",
                    backgroundColor: "#020617"
                }}
            >
                {/* 1. Radar do Jogador */}
                {userLocation && (
                    <OverlayView
                        position={userLocation}
                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        getPixelPositionOffset={(w, h) => ({ x: -20, y: -20 })}
                    >
                        <div className="relative w-10 h-10 flex items-center justify-center pointer-events-none">
                            <div className="absolute w-[200%] h-[200%] border border-indigo-500/30 rounded-full animate-ping"></div>
                            <div className="w-4 h-4 bg-indigo-500 rounded-full border-2 border-white shadow-[0_0_15px_#6366f1] z-10"></div>
                        </div>
                    </OverlayView>
                )}

                {/* 2. Pinos dos Mercados */}
                {marketPins.map(pin => (
                    <OverlayView
                        key={pin.id}
                        position={{ lat: pin.latitude, lng: pin.longitude }}
                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        getPixelPositionOffset={(w, h) => ({ x: 0, y: 0 })}
                    >
                        <ArenaMarker
                            pin={pin}
                            onClick={() => {
                                setSelectedMarket(pin);
                                // Centraliza levemente acima para dar espaço ao Sheet
                                map?.panTo({ lat: pin.latitude, lng: pin.longitude });
                            }}
                        />
                    </OverlayView>
                ))}
            </GoogleMap>

            {/* SHEET DE DETALHES (PAINEL TÁTICO) */}
            <Sheet open={!!selectedMarket} onOpenChange={(open) => !open && setSelectedMarket(null)}>
                <SheetContent side="bottom" className="rounded-t-3xl border-t border-slate-800 bg-slate-950 p-0 text-white z-[60]">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Detalhes da Arena: {selectedMarket?.name}</SheetTitle>
                    </SheetHeader>

                    {selectedMarket && (
                        <>
                            {/* Cabeçalho Visual do Sheet */}
                            <div className={cn("h-24 w-full relative overflow-hidden rounded-t-3xl",
                                selectedMarket.status === 'sovereign' ? "bg-gradient-to-b from-yellow-900/40 to-slate-950" :
                                    selectedMarket.status === 'hostile' ? "bg-gradient-to-b from-rose-900/40 to-slate-950" :
                                        "bg-gradient-to-b from-cyan-900/40 to-slate-950"
                            )}>
                                <div className="absolute top-4 left-6 z-10">
                                    <h2 className="text-xl font-bold text-white drop-shadow-md">{selectedMarket.name}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <MapPin className="w-3 h-3 text-slate-400" />
                                        <span className="text-xs text-slate-300">Mercado Local</span>
                                    </div>
                                </div>
                                <div className="absolute right-4 top-4">
                                    {selectedMarket.status === 'sovereign' && <Badge className="bg-yellow-500 text-black border-none font-bold">DOMINADO</Badge>}
                                    {selectedMarket.status === 'hostile' && <Badge className="bg-rose-600 text-white border-none">HOSTIL</Badge>}
                                    {selectedMarket.status === 'neutral' && <Badge variant="outline" className="text-cyan-400 border-cyan-600 bg-cyan-950/50">NEUTRO</Badge>}
                                </div>
                            </div>

                            {/* Corpo do Sheet */}
                            <div className="px-6 pb-8 -mt-6 relative z-20">
                                {/* Card do Soberano */}
                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-xl mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            {selectedMarket.status === 'neutral' ? (
                                                <div className="w-12 h-12 border-2 border-slate-600 rounded-full flex items-center justify-center bg-slate-800">
                                                    <Ghost className="w-6 h-6 text-slate-500" />
                                                </div>
                                            ) : (
                                                <Avatar className={cn("w-12 h-12 border-2", selectedMarket.status === 'sovereign' ? "border-yellow-500" : "border-rose-600")}>
                                                    <AvatarImage src={selectedMarket.sovereign.avatar || ""} />
                                                    <AvatarFallback>S</AvatarFallback>
                                                </Avatar>
                                            )}
                                            {selectedMarket.status !== 'neutral' && <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5"><Crown className={cn("w-3 h-3", selectedMarket.status === 'sovereign' ? "text-yellow-500" : "text-rose-500")} /></div>}
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Soberano Atual</p>
                                            <p className="text-sm font-bold text-white">{selectedMarket.sovereign.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Pontos</p>
                                        <p className="text-lg font-mono font-bold text-indigo-400">{selectedMarket.sovereign.score}</p>
                                    </div>
                                </div>

                                {/* Estatísticas Rápidas */}
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 text-center">
                                        <span className="text-xs text-slate-400 block mb-1">Seu Score Aqui</span>
                                        <span className="text-white font-bold">{selectedMarket.myScore}</span>
                                    </div>
                                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 text-center">
                                        <span className="text-xs text-slate-400 block mb-1">Diferença</span>
                                        <span className={cn("font-bold", selectedMarket.status === 'sovereign' ? "text-green-400" : "text-rose-400")}>
                                            {selectedMarket.sovereign.score > selectedMarket.myScore
                                                ? `-${selectedMarket.sovereign.score - selectedMarket.myScore}`
                                                : "Liderando"
                                            }
                                        </span>
                                    </div>
                                </div>

                                {/* Botão de Ação */}
                                <Button
                                    className={cn("w-full h-14 text-lg font-bold rounded-2xl shadow-lg transition-transform active:scale-95",
                                        selectedMarket.status === 'sovereign'
                                            ? "bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-900/20"
                                            : selectedMarket.status === 'neutral'
                                                ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-900/20"
                                                : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30"
                                    )}
                                    onClick={() => navigate(`/lista/nova`)} // Ação de Pontuar = Criar Lista
                                >
                                    {selectedMarket.status === 'sovereign' ? (
                                        <><Shield className="w-5 h-5 mr-2" /> MANTER DOMÍNIO</>
                                    ) : selectedMarket.status === 'neutral' ? (
                                        <><Crosshair className="w-5 h-5 mr-2" /> REIVINDICAR</>
                                    ) : (
                                        <><Swords className="w-5 h-5 mr-2" /> ATACAR AGORA</>
                                    )}
                                </Button>
                                <p className="text-center text-[10px] text-slate-500 mt-3">Criar uma lista neste mercado rende +100 pontos.</p>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            {/* 2. MELHORIA: Menu Inferior mais destacado (Visual Glassmorphism) */}
            <div className="fixed bottom-6 left-6 right-6 z-40 pointer-events-none">
                <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-1 shadow-2xl pointer-events-auto">
                    <AppMenu />
                </div>
            </div>
        </div>
    );
}
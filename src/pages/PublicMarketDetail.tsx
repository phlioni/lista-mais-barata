import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Navigation, ShoppingBag, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AppMenu } from "@/components/AppMenu";

interface MarketDetailData {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    image_url?: string;
}

export default function PublicMarketDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [market, setMarket] = useState<MarketDetailData | null>(null);
    const [stats, setStats] = useState<{ completed_lists: number }>({ completed_lists: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) loadMarketData();
    }, [id]);

    const loadMarketData = async () => {
        try {
            const { data: marketData, error: marketError } = await supabase
                .from('markets')
                .select('*')
                .eq('id', id)
                .single();

            if (marketError) throw marketError;
            setMarket(marketData);

            const { data: statsData, error: statsError } = await supabase.rpc('get_market_stats', {
                target_market_id: id
            });

            if (!statsError && statsData) {
                setStats(statsData);
            }

        } catch (error) {
            console.error("Erro ao carregar mercado:", error);
        } finally {
            setLoading(false);
        }
    };

    const openWaze = () => {
        if (!market) return;
        const url = `https://waze.com/ul?ll=${market.latitude},${market.longitude}&navigate=yes`;
        window.open(url, '_blank');
    };

    const openGoogleMaps = () => {
        if (!market) return;
        const url = `https://www.google.com/maps/search/?api=1&query=${market.latitude},${market.longitude}`;
        window.open(url, '_blank');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!market) return null;

    return (
        <div className="min-h-screen bg-background relative pb-safe">
            {/* Header Hero */}
            <div className="relative h-72 bg-gradient-to-br from-indigo-600 to-purple-700 overflow-hidden">
                {/* Círculos decorativos de fundo */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-pink-500/20 rounded-full translate-y-1/3 -translate-x-1/4 blur-2xl" />

                {/* Navbar Transparente */}
                <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(-1)}
                        className="bg-black/20 hover:bg-black/30 text-white rounded-full backdrop-blur-md border border-white/10"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <AppMenu triggerClassName="text-white hover:bg-white/20 bg-black/20 backdrop-blur-md rounded-full p-2" />
                </div>

                {/* Conteúdo do Header */}
                <div className="absolute bottom-0 left-0 w-full p-6 pb-12 bg-gradient-to-t from-background via-background/60 to-transparent flex flex-col items-center text-center z-10">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-4 text-indigo-600 rotate-3 border-4 border-white/50">
                        <Store className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-display font-bold text-foreground drop-shadow-sm mb-2">{market.name}</h1>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium bg-background/50 px-3 py-1 rounded-full backdrop-blur-sm border border-border/50">
                        <MapPin className="w-3.5 h-3.5 text-primary" /> {market.address}
                    </p>
                </div>
            </div>

            {/* Corpo da Página */}
            <div className="px-5 -mt-6 relative z-20 space-y-6">

                {/* Card de Estatística Única (Foco em Compras) */}
                <div className="bg-card border border-border/60 shadow-lg shadow-indigo-500/5 rounded-2xl p-5 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-indigo-500/10 to-transparent" />
                    <div>
                        <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Movimentação</p>
                        <p className="text-indigo-900 font-display font-bold text-lg">
                            {stats.completed_lists} <span className="text-sm font-normal text-muted-foreground">compras registradas</span>
                        </p>
                    </div>
                    <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
                        <ShoppingBag className="w-6 h-6" />
                    </div>
                </div>

                {/* Seção de Localização e Ações */}
                <div className="space-y-4">
                    <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                        <Navigation className="w-5 h-5 text-indigo-500" /> Como chegar
                    </h3>

                    {/* Mapa Visual Clean */}
                    <div
                        onClick={openGoogleMaps}
                        className="group relative w-full h-48 bg-secondary/30 rounded-3xl overflow-hidden border border-border cursor-pointer transition-all hover:shadow-md"
                    >
                        {/* Imagem de Fundo (Mapa Abstrato) */}
                        <div className="absolute inset-0 opacity-60 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-500" />

                        {/* Marcador Central Animado */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative">
                                <div className="w-4 h-4 bg-indigo-500 rounded-full animate-ping absolute inset-0 opacity-75"></div>
                                <div className="w-4 h-4 bg-indigo-600 rounded-full relative shadow-xl border-2 border-white"></div>
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white text-indigo-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
                                    {market.name}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Botões Grandes de Ação */}
                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            onClick={openWaze}
                            className="h-14 rounded-2xl bg-[#33CCFF] hover:bg-[#2abbe8] text-white font-bold text-base shadow-lg shadow-blue-400/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Navigation className="w-5 h-5 mr-2" /> Waze
                        </Button>

                        <Button
                            onClick={openGoogleMaps}
                            className="h-14 rounded-2xl bg-white border border-border text-foreground hover:bg-gray-50 font-bold text-base shadow-lg shadow-gray-200/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <MapPin className="w-5 h-5 mr-2 text-red-500" /> Google Maps
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
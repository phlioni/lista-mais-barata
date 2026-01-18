import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Trophy,
    Crown,
    Sparkles,
    Plus,
    ArrowRight,
    Target,
    Flame,
    Loader2,
    Settings,
    Info,
    CalendarCheck,
    Gift,
    Users,
    MessageCircle,
    ChevronRight,
    Quote
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppMenu } from "@/components/AppMenu";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeaderboardItem {
    user_id: string;
    display_name: string;
    avatar_url?: string;
    total_points: number;
    rank: number;
}

interface LatestPost {
    id: string;
    content: string;
    created_at: string;
    profiles: {
        display_name: string | null;
        avatar_url: string | null;
    } | null;
}

export default function Gamification() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    const [loading, setLoading] = useState(true);
    const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
    const [myPoints, setMyPoints] = useState(0);
    const [myRank, setMyRank] = useState<number | string>("-");
    const [myProfile, setMyProfile] = useState<{ name: string, avatar: string | null } | null>(null);
    const [isRulesOpen, setIsRulesOpen] = useState(false);
    const [latestPost, setLatestPost] = useState<LatestPost | null>(null);

    // Timestamp fixo para evitar "piscar" das imagens no Safari
    const [sessionTimestamp] = useState(Date.now());

    const TARGET_POINTS = 200;

    const getSecureUrl = (url: string | null | undefined) => {
        if (!url) return undefined;
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}t=${sessionTimestamp}`;
    };

    useEffect(() => {
        if (!authLoading && !user) navigate("/auth");
    }, [user, authLoading, navigate]);

    useEffect(() => {
        if (user) loadData();
    }, [user]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Ranking com Ordenação Explícita no Front (CORREÇÃO AQUI)
            const { data: rankingData } = await supabase.rpc('get_monthly_leaderboard');

            // Garante a ordem correta (maior pontuação primeiro)
            const sortedRanking = (rankingData || []).sort((a: LeaderboardItem, b: LeaderboardItem) => b.total_points - a.total_points);

            // Recalcula o rank visual baseado na posição do array ordenado
            const rankingWithCorrectRank = sortedRanking.map((item: LeaderboardItem, index: number) => ({
                ...item,
                rank: index + 1
            }));

            setLeaderboard(rankingWithCorrectRank);

            // 2. Pontos
            const { data: pointsData } = await supabase.rpc('get_my_monthly_points');
            setMyPoints(pointsData || 0);

            // 3. Perfil
            const { data: profileData } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user!.id).single();
            if (profileData) {
                setMyProfile({ name: profileData.display_name || "Você", avatar: profileData.avatar_url });
            }

            // 4. Rank (CORREÇÃO AQUI: Usa o array ordenado para achar a posição)
            const meInLeaderboard = rankingWithCorrectRank.find((item: LeaderboardItem) => item.user_id === user!.id);
            if (meInLeaderboard) {
                setMyRank(meInLeaderboard.rank);
                // Opcional: Atualizar pontos com o dado do ranking para garantir consistência
                setMyPoints(meInLeaderboard.total_points);
            }

            // 5. Último Post (Widget da Comunidade)
            const { data: postData } = await supabase
                .from('posts')
                .select(`
          id, content, created_at, 
          profiles (display_name, avatar_url)
        `)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (postData) {
                setLatestPost({
                    id: postData.id,
                    content: postData.content,
                    created_at: postData.created_at,
                    // @ts-ignore
                    profiles: Array.isArray(postData.profiles) ? postData.profiles[0] : postData.profiles
                });
            }

        } catch (error) {
            console.error("Erro ao carregar:", error);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    if (!user) return null;

    const topThree = leaderboard.slice(0, 3);
    const restOfList = leaderboard.slice(3);
    const progress = Math.min((myPoints / TARGET_POINTS) * 100, 100);

    return (
        <div className="min-h-screen bg-gray-50/50 pb-24 font-sans">
            {/* Background Sutil */}
            <div className="fixed top-0 left-0 w-full h-[400px] bg-gradient-to-b from-indigo-500/10 to-transparent -z-10" />

            {/* Header Transparente */}
            <header className="px-5 py-4 flex items-center justify-between sticky top-0 z-20 backdrop-blur-sm bg-background/60 border-b border-border/20">
                <div>
                    <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
                        Ranking Mensal <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-pulse" />
                    </h1>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/configuracoes")} className="rounded-full hover:bg-background/80">
                        <Settings className="w-5 h-5 text-muted-foreground" />
                    </Button>
                    <AppMenu triggerClassName="rounded-full hover:bg-background/80" />
                </div>
            </header>

            <main className="px-5 py-6 space-y-6">

                {/* 1. HERO CARD: O "Cartão de Crédito" do Jogador */}
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] p-6 text-white shadow-xl shadow-indigo-500/20">
                    {/* Círculos decorativos */}
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                    <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-pink-500/20 blur-2xl" />

                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <Avatar className="w-14 h-14 border-[3px] border-white/30 shadow-inner">
                                    <AvatarImage src={getSecureUrl(myProfile?.avatar)} className="object-cover" />
                                    <AvatarFallback className="bg-indigo-800 text-white font-bold">EU</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-indigo-100 text-xs font-medium uppercase tracking-wider mb-0.5">Sua Pontuação</p>
                                    <h2 className="text-3xl font-bold tracking-tight flex items-baseline gap-1">
                                        {myPoints} <span className="text-sm font-normal opacity-70">pts</span>
                                    </h2>
                                </div>
                            </div>
                            <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex flex-col items-center">
                                <span className="text-[10px] uppercase font-bold text-indigo-100">Rank</span>
                                <span className="text-lg font-bold leading-none">#{myRank}</span>
                            </div>
                        </div>

                        {/* Barra de Progresso com Meta */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-medium text-indigo-100/80">
                                <span>Prêmio Mensal</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-3 bg-black/20 rounded-full p-0.5 backdrop-blur-sm overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-yellow-300 to-orange-400 rounded-full shadow-[0_0_10px_rgba(253,186,116,0.6)] relative transition-all duration-1000"
                                    style={{ width: `${progress}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_2s_infinite]" />
                                </div>
                            </div>
                            <div
                                onClick={() => setIsRulesOpen(true)}
                                className="flex items-center gap-1.5 text-xs text-indigo-100 mt-2 cursor-pointer hover:text-white transition-colors w-fit"
                            >
                                <Target className="w-3.5 h-3.5" />
                                <span>Faltam <strong>{Math.max(0, TARGET_POINTS - myPoints)}</strong> para o iFood R$100</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. WIDGET DA COMUNIDADE (Pulse) */}
                <div
                    onClick={() => navigate('/comunidade')}
                    className="group relative bg-white border border-indigo-50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
                >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-pink-500 to-purple-500" />

                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-500" />
                            Na Comunidade
                        </h3>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                    </div>

                    {latestPost ? (
                        <div className="flex gap-3 items-start mt-1">
                            <div className="relative">
                                <Avatar className="w-10 h-10 border border-gray-100">
                                    <AvatarImage src={getSecureUrl(latestPost.profiles?.avatar_url)} />
                                    <AvatarFallback className="text-xs bg-gray-100 text-gray-500">{latestPost.profiles?.display_name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 border-2 border-white rounded-full" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline">
                                    <p className="text-sm font-bold text-gray-800 truncate">{latestPost.profiles?.display_name}</p>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatDistanceToNow(new Date(latestPost.created_at), { locale: ptBR, addSuffix: true })}</span>
                                </div>
                                <div className="flex gap-1 mt-0.5">
                                    <Quote className="w-3 h-3 text-gray-300 fill-gray-100 shrink-0 mt-0.5" />
                                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                                        {latestPost.content}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 py-1">
                            <div className="bg-gray-50 p-2 rounded-full">
                                <MessageCircle className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-600">Ainda está silencioso...</p>
                                <p className="text-xs text-gray-400">Seja o primeiro a compartilhar uma oferta!</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. LEADERBOARD (Design Limpo e Horizontal) */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            Top 3
                        </h2>
                        <span className="text-xs text-muted-foreground">Atualizado agora</span>
                    </div>

                    {/* PODIUM HORIZONTAL - Mais compacto */}
                    {topThree.length > 0 && (
                        <div className="grid grid-cols-3 gap-3 mb-6 items-end">
                            {/* 2º Lugar */}
                            <div className="flex flex-col items-center">
                                <div className="relative mb-2">
                                    <Avatar className="w-12 h-12 border-2 border-gray-200">
                                        <AvatarImage src={getSecureUrl(topThree[1]?.avatar_url)} />
                                        <AvatarFallback>2</AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-2 bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">#2</div>
                                </div>
                                <p className="text-xs font-bold text-gray-700 truncate w-full text-center mt-1">{topThree[1]?.display_name || "-"}</p>
                                <p className="text-[10px] text-gray-500 font-medium">{topThree[1]?.total_points || 0}</p>
                            </div>

                            {/* 1º Lugar (Destaque) */}
                            <div className="flex flex-col items-center relative -top-2">
                                <Crown className="w-6 h-6 text-yellow-400 fill-yellow-400 animate-bounce mb-1" />
                                <div className="relative mb-2">
                                    <Avatar className="w-16 h-16 border-4 border-yellow-400 shadow-lg ring-2 ring-yellow-100">
                                        <AvatarImage src={getSecureUrl(topThree[0]?.avatar_url)} />
                                        <AvatarFallback className="bg-yellow-100 text-yellow-700">1</AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-2.5 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-0.5 rounded-full shadow-md">#1</div>
                                </div>
                                <p className="text-sm font-bold text-gray-800 truncate w-full text-center mt-1">{topThree[0]?.display_name || "Vago"}</p>
                                <p className="text-xs text-yellow-600 font-bold">{topThree[0]?.total_points || 0} pts</p>
                            </div>

                            {/* 3º Lugar */}
                            <div className="flex flex-col items-center">
                                <div className="relative mb-2">
                                    <Avatar className="w-12 h-12 border-2 border-orange-200">
                                        <AvatarImage src={getSecureUrl(topThree[2]?.avatar_url)} />
                                        <AvatarFallback>3</AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-2 bg-orange-200 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">#3</div>
                                </div>
                                <p className="text-xs font-bold text-gray-700 truncate w-full text-center mt-1">{topThree[2]?.display_name || "-"}</p>
                                <p className="text-[10px] text-gray-500 font-medium">{topThree[2]?.total_points || 0}</p>
                            </div>
                        </div>
                    )}

                    {/* LISTA DE COMPETIDORES (Minimalista) */}
                    <div className="bg-white rounded-2xl border border-gray-100/80 shadow-sm overflow-hidden">
                        {restOfList.length === 0 && topThree.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                Ranking reiniciado. Seja o primeiro!
                            </div>
                        ) : (
                            restOfList.map((player) => (
                                <div
                                    key={player.user_id}
                                    className={cn(
                                        "flex items-center justify-between p-3.5 border-b border-gray-50 last:border-0 transition-colors",
                                        player.user_id === user?.id ? "bg-indigo-50/50" : "hover:bg-gray-50/50"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-gray-400 font-bold text-sm w-6 text-center">#{player.rank}</span>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="w-9 h-9 border border-gray-100">
                                                <AvatarImage src={getSecureUrl(player.avatar_url)} />
                                                <AvatarFallback className="text-xs">{player.rank}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className={cn("text-sm font-medium truncate max-w-[140px]", player.user_id === user?.id ? "text-indigo-700" : "text-gray-700")}>
                                                    {player.display_name}
                                                </p>
                                                {player.user_id === user?.id && <span className="text-[9px] text-indigo-500 font-bold uppercase tracking-wide">Você</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-bold text-gray-800">{player.total_points}</span>
                                        <span className="text-[10px] text-gray-400 ml-1">pts</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>

            {/* Botão Flutuante (FAB) */}
            <div className="fixed bottom-20 left-0 right-0 px-5 z-40 pointer-events-none">
                <div className="pointer-events-auto shadow-2xl shadow-indigo-500/30 rounded-2xl">
                    <Button
                        onClick={() => navigate("/listas")}
                        className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold flex justify-between px-6 transition-transform active:scale-98"
                    >
                        <span className="flex items-center gap-2"><Plus className="w-5 h-5" /> Minhas Listas</span>
                        <span className="text-xs font-normal bg-white/20 px-2 py-1 rounded-lg flex items-center gap-1">+50 pts <ArrowRight className="w-3 h-3" /></span>
                    </Button>
                </div>
            </div>

            {/* Modal de Regras */}
            <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
                <DialogContent className="rounded-2xl w-[90%] max-w-sm">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-indigo-600" /> Objetivo</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-3 bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-100">
                            <div className="bg-white p-2 rounded-full shadow-sm"><Gift className="w-6 h-6 text-green-600" /></div>
                            <div>
                                <p className="font-bold text-green-900">Vale iFood R$ 100</p>
                                <p className="text-xs text-green-700 mt-0.5">Para o primeiro a atingir <strong>200 pontos</strong> no mês.</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Como Pontuar</h4>
                            <div className="flex gap-3 items-start text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                <CalendarCheck className="w-5 h-5 text-indigo-500 shrink-0" />
                                <div>
                                    <span className="font-bold text-gray-800">+50 pontos</span> por semana ao finalizar uma lista de compras com preços reais.
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter><Button className="w-full rounded-xl" onClick={() => setIsRulesOpen(false)}>Entendi</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
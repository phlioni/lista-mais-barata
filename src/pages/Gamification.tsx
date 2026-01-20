import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Trophy,
    Sparkles,
    Plus,
    ArrowRight,
    Target,
    Flame,
    Loader2,
    Settings,
    Gift,
    Users,
    MessageCircle,
    ChevronRight,
    ShoppingBag,
    Medal,
    Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppMenu } from "@/components/AppMenu";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    const [isRankingOpen, setIsRankingOpen] = useState(false);
    const [latestPost, setLatestPost] = useState<LatestPost | null>(null);
    const [greeting, setGreeting] = useState("");

    // Timestamp para cache busting de imagens
    const [sessionTimestamp] = useState(Date.now());

    const TARGET_POINTS = 200;

    const getSecureUrl = (url: string | null | undefined) => {
        if (!url) return undefined;
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}t=${sessionTimestamp}`;
    };

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting("Bom dia");
        else if (hour < 18) setGreeting("Boa tarde");
        else setGreeting("Boa noite");
    }, []);

    useEffect(() => {
        if (!authLoading && !user) navigate("/auth");
    }, [user, authLoading, navigate]);

    useEffect(() => {
        if (user) loadData();
    }, [user]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rankingRes, pointsRes, profileRes, postRes] = await Promise.all([
                supabase.rpc('get_monthly_leaderboard'),
                supabase.rpc('get_my_monthly_points'),
                supabase.from('profiles').select('display_name, avatar_url').eq('id', user!.id).single(),
                supabase.from('posts').select(`id, content, created_at, profiles (display_name, avatar_url)`).order('created_at', { ascending: false }).limit(1).maybeSingle()
            ]);

            const rankingData = rankingRes.data || [];
            const sortedRanking = rankingData.sort((a: LeaderboardItem, b: LeaderboardItem) => b.total_points - a.total_points);
            const rankingWithCorrectRank = sortedRanking.map((item: LeaderboardItem, index: number) => ({
                ...item,
                rank: index + 1
            }));

            setLeaderboard(rankingWithCorrectRank);

            const points = pointsRes.data || 0;
            setMyPoints(points);

            const meInLeaderboard = rankingWithCorrectRank.find((item: LeaderboardItem) => item.user_id === user!.id);
            if (meInLeaderboard) {
                setMyRank(meInLeaderboard.rank);
                if (meInLeaderboard.total_points > points) setMyPoints(meInLeaderboard.total_points);
            }

            if (profileRes.data) {
                setMyProfile({ name: profileRes.data.display_name || "Visitante", avatar: profileRes.data.avatar_url });
            }

            if (postRes.data) {
                setLatestPost({
                    id: postRes.data.id,
                    content: postRes.data.content,
                    created_at: postRes.data.created_at,
                    // @ts-ignore
                    profiles: Array.isArray(postRes.data.profiles) ? postRes.data.profiles[0] : postRes.data.profiles
                });
            }

        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    if (!user) return null;

    const topThree = leaderboard.slice(0, 3);
    const progress = Math.min((myPoints / TARGET_POINTS) * 100, 100);
    const pointsToTarget = Math.max(0, TARGET_POINTS - myPoints);

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans pb-32">
            {/* Header Moderno e Clean */}
            <header className="px-6 pt-12 pb-4 bg-white border-b border-gray-100/50 sticky top-0 z-30 backdrop-blur-md bg-white/80 supports-[backdrop-filter]:bg-white/60">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Avatar corrigido: shrink-0 evita distorção */}
                        <Avatar className="w-10 h-10 border-2 border-indigo-100 cursor-pointer transition-transform hover:scale-105 shrink-0">
                            <AvatarImage src={getSecureUrl(myProfile?.avatar)} className="object-cover w-full h-full aspect-square" />
                            <AvatarFallback className="bg-indigo-50 text-indigo-600 font-bold">
                                {myProfile?.name?.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground font-medium">{greeting},</span>
                            <span className="text-sm font-bold text-gray-900 leading-none truncate max-w-[150px]">
                                {myProfile?.name?.split(' ')[0]}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/configuracoes")} className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full">
                            <Settings className="w-5 h-5" />
                        </Button>
                        <AppMenu triggerClassName="rounded-full hover:bg-indigo-50 text-gray-400 hover:text-indigo-600" />
                    </div>
                </div>
            </header>

            <main className="px-5 pt-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* 1. HERO CARD: Cartão de Crédito Gamificado */}
                <section className="relative">
                    <div className="absolute inset-0 bg-indigo-500 blur-[60px] opacity-10 rounded-full pointer-events-none transform -translate-y-10" />
                    <Card className="border-none shadow-xl shadow-indigo-200/40 bg-gradient-to-br from-[#4F46E5] to-[#6366f1] text-white overflow-hidden relative group rounded-3xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                        <CardContent className="p-6 relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-none px-2 py-0.5 h-auto text-[10px] uppercase tracking-wider font-bold backdrop-blur-sm">
                                            Ranking Mensal
                                        </Badge>
                                        <div className="flex items-center gap-1 text-[10px] text-indigo-200 font-medium bg-black/20 px-2 py-0.5 rounded-full">
                                            <Trophy className="w-3 h-3 text-yellow-300" /> #{myRank} Geral
                                        </div>
                                    </div>
                                    <h2 className="text-4xl font-bold tracking-tight flex items-baseline gap-1 mt-2 font-display">
                                        {myPoints}
                                    </h2>
                                    <p className="text-indigo-200 text-xs font-medium">pontos acumulados</p>
                                </div>
                                <div
                                    className="bg-white/10 p-2.5 rounded-2xl backdrop-blur-md border border-white/10 cursor-pointer hover:bg-white/20 transition-colors active:scale-95"
                                    onClick={() => setIsRulesOpen(true)}
                                >
                                    <Gift className="w-6 h-6 text-white animate-pulse" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-medium text-indigo-100">
                                    <span>Próxima recompensa</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="relative h-2.5 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
                                    <div
                                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-300 to-orange-400 rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]" />
                                    </div>
                                </div>
                                <p className="text-[11px] text-indigo-200 mt-2 flex items-center gap-1.5">
                                    {pointsToTarget > 0 ? (
                                        <>
                                            <Target className="w-3 h-3" /> Faltam <strong>{pointsToTarget} pts</strong> para o voucher iFood
                                        </>
                                    ) : (
                                        <><Sparkles className="w-3 h-3 text-yellow-300" /> Meta batida! Você é incrível.</>
                                    )}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* 2. SUPER BUTTON: Ação Principal (Substitui o Grid) */}
                <section>
                    <button
                        onClick={() => navigate("/listas")}
                        className="w-full bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center justify-between group active:scale-[0.98] transition-all hover:border-indigo-200 hover:shadow-md relative overflow-hidden"
                    >
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500" />
                        <div className="flex items-center gap-4">
                            <div className="bg-indigo-50 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                <Plus className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
                            </div>
                            <div className="text-left">
                                <span className="block font-bold text-gray-900 text-lg">Nova Lista de Compras</span>
                                <span className="text-xs text-muted-foreground group-hover:text-indigo-600 transition-colors">Comece a economizar agora</span>
                            </div>
                        </div>
                        <div className="bg-green-50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                            <span className="text-xs font-bold text-green-700">+50 pts</span>
                            <ArrowRight className="w-3.5 h-3.5 text-green-700" />
                        </div>
                    </button>
                </section>

                {/* 3. COMUNIDADE (Widget Compacto) */}
                <section>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-500" /> Comunidade
                        </h3>
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-indigo-600 hover:bg-transparent hover:text-indigo-800" onClick={() => navigate("/comunidade")}>
                            Ver tudo
                        </Button>
                    </div>

                    <div
                        onClick={() => navigate('/comunidade')}
                        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-4 active:bg-gray-50 transition-colors cursor-pointer"
                    >
                        {latestPost ? (
                            <>
                                <div className="relative shrink-0">
                                    <Avatar className="w-10 h-10 border border-gray-100 shrink-0">
                                        <AvatarImage src={getSecureUrl(latestPost.profiles?.avatar_url)} className="object-cover w-full h-full aspect-square" />
                                        <AvatarFallback>{latestPost.profiles?.display_name?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 border-2 border-white rounded-full" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm font-bold text-gray-900 truncate pr-2">{latestPost.profiles?.display_name}</p>
                                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatDistanceToNow(new Date(latestPost.created_at), { locale: ptBR, addSuffix: true })}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">{latestPost.content}</p>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-3 text-gray-500 w-full justify-center py-2">
                                <MessageCircle className="w-5 h-5" />
                                <span className="text-sm">Nenhuma novidade por enquanto.</span>
                            </div>
                        )}
                    </div>
                </section>

                {/* 4. RANKING TOP 3 (Com gatilho para modal completo) */}
                <section>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Flame className="w-4 h-4 text-orange-500" /> Melhores do Mês
                        </h3>
                    </div>

                    <Card className="border-gray-100 shadow-sm overflow-hidden rounded-2xl">
                        <CardContent className="p-0">
                            {/* Top 3 Visual */}
                            {topThree.length > 0 ? (
                                <div className="flex justify-center items-end gap-3 sm:gap-6 py-8 pb-6 bg-gradient-to-b from-white to-gray-50/80">

                                    {/* 2º Lugar */}
                                    <div className="flex flex-col items-center">
                                        <div className="relative mb-2">
                                            <Avatar className="w-12 h-12 border-2 border-gray-200 shrink-0 shadow-sm">
                                                <AvatarImage src={getSecureUrl(topThree[1]?.avatar_url)} className="object-cover w-full h-full aspect-square" />
                                                <AvatarFallback>2</AvatarFallback>
                                            </Avatar>
                                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">#2</div>
                                        </div>
                                        <span className="text-[11px] font-bold mt-1 text-gray-700 max-w-[70px] truncate text-center">{topThree[1]?.display_name}</span>
                                        <span className="text-[10px] text-gray-400 font-medium">{topThree[1]?.total_points}</span>
                                    </div>

                                    {/* 1º Lugar */}
                                    <div className="flex flex-col items-center -mt-6 relative z-10">
                                        <Crown className="w-6 h-6 text-yellow-400 fill-yellow-400 animate-bounce mb-1" />
                                        <div className="relative mb-2">
                                            <Avatar className="w-16 h-16 border-4 border-yellow-400 shadow-lg ring-4 ring-yellow-50 shrink-0">
                                                <AvatarImage src={getSecureUrl(topThree[0]?.avatar_url)} className="object-cover w-full h-full aspect-square" />
                                                <AvatarFallback className="bg-yellow-100 text-yellow-700">1</AvatarFallback>
                                            </Avatar>
                                            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-950 text-xs font-bold px-3 py-0.5 rounded-full shadow-md whitespace-nowrap">#1</div>
                                        </div>
                                        <span className="text-xs font-bold mt-1 text-gray-900 max-w-[90px] truncate text-center">{topThree[0]?.display_name}</span>
                                        <span className="text-[11px] text-yellow-600 font-extrabold">{topThree[0]?.total_points} pts</span>
                                    </div>

                                    {/* 3º Lugar */}
                                    <div className="flex flex-col items-center">
                                        <div className="relative mb-2">
                                            <Avatar className="w-12 h-12 border-2 border-orange-200 shrink-0 shadow-sm">
                                                <AvatarImage src={getSecureUrl(topThree[2]?.avatar_url)} className="object-cover w-full h-full aspect-square" />
                                                <AvatarFallback>3</AvatarFallback>
                                            </Avatar>
                                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-200 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">#3</div>
                                        </div>
                                        <span className="text-[11px] font-bold mt-1 text-gray-700 max-w-[70px] truncate text-center">{topThree[2]?.display_name}</span>
                                        <span className="text-[10px] text-gray-400 font-medium">{topThree[2]?.total_points}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-400 text-sm">
                                    Processando ranking...
                                </div>
                            )}

                            {/* Botão para abrir o Modal de Ranking Completo */}
                            <div
                                className="bg-white border-t border-gray-100 p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors active:bg-gray-100"
                                onClick={() => setIsRankingOpen(true)}
                            >
                                <span className="text-sm font-semibold text-indigo-600 flex items-center justify-center gap-2">
                                    Ver ranking completo <ChevronRight className="w-4 h-4" />
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </section>

            </main>

            {/* MODAL: Ranking Completo */}
            <Dialog open={isRankingOpen} onOpenChange={setIsRankingOpen}>
                <DialogContent className="rounded-2xl w-[95%] max-w-md h-[80vh] p-0 overflow-hidden flex flex-col gap-0 bg-gray-50">
                    <DialogHeader className="p-5 bg-white border-b border-gray-100 shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" /> Ranking do Mês
                        </DialogTitle>
                    </DialogHeader>

                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-1">
                            {leaderboard.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">Nenhum competidor ainda.</div>
                            ) : (
                                leaderboard.map((player) => (
                                    <div
                                        key={player.user_id}
                                        className={cn(
                                            "flex items-center justify-between p-3 rounded-xl transition-all border",
                                            player.user_id === user?.id
                                                ? "bg-indigo-50 border-indigo-200 shadow-sm"
                                                : "bg-white border-transparent hover:border-gray-200"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-8 text-center font-bold text-sm",
                                                player.rank <= 3 ? "text-yellow-600 text-lg" : "text-gray-400"
                                            )}>
                                                #{player.rank}
                                            </div>
                                            <Avatar className="w-10 h-10 border border-gray-100 shrink-0">
                                                <AvatarImage src={getSecureUrl(player.avatar_url)} className="object-cover w-full h-full aspect-square" />
                                                <AvatarFallback className="text-xs font-bold text-gray-500 bg-gray-100">{player.rank}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className={cn(
                                                    "text-sm font-bold truncate max-w-[120px]",
                                                    player.user_id === user?.id ? "text-indigo-700" : "text-gray-700"
                                                )}>
                                                    {player.display_name}
                                                    {player.user_id === user?.id && " (Você)"}
                                                </p>
                                                {player.rank <= 3 && <span className="text-[9px] text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded font-bold">Top Player</span>}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-sm font-bold text-gray-900">{player.total_points}</span>
                                            <span className="text-[10px] text-gray-400 uppercase">Pontos</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>

                    <div className="p-4 bg-white border-t border-gray-100 text-center text-xs text-gray-400 shrink-0">
                        O ranking atualiza em tempo real. Continue pontuando!
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL: Regras (Mantido) */}
            <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
                <DialogContent className="rounded-2xl w-[90%] max-w-sm">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-indigo-600" /> Como Ganhar</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
                            <div className="bg-white p-2 rounded-full shadow-sm"><Gift className="w-6 h-6 text-indigo-600" /></div>
                            <div>
                                <p className="font-bold text-indigo-900">Vale iFood R$ 100</p>
                                <p className="text-xs text-indigo-700 mt-0.5">Meta Mensal: <strong>200 pontos</strong></p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Missões</h4>
                            <div className="flex gap-3 items-center text-sm text-gray-700 bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                                <div className="bg-green-100 p-1.5 rounded-md"><ShoppingBag className="w-4 h-4 text-green-700" /></div>
                                <div>
                                    <span className="font-bold block">Finalizar Lista</span>
                                    <span className="text-xs text-gray-500">+50 pontos por semana</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter><Button className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700" onClick={() => setIsRulesOpen(false)}>Bora pontuar!</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
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
    Medal,
    Loader2,
    Settings // Novo ícone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppMenu } from "@/components/AppMenu";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaderboardItem {
    user_id: string;
    display_name: string; // Atualizado
    avatar_url?: string;  // Atualizado
    total_points: number;
    rank: number;
}

export default function Gamification() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);

    const [myPoints, setMyPoints] = useState(0);
    const [myRank, setMyRank] = useState<number | string>("-");
    const [myProfile, setMyProfile] = useState<{ name: string, avatar: string } | null>(null);

    const TARGET_POINTS = 200;

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Buscar Ranking Geral
            const { data: rankingData, error: rankError } = await supabase.rpc('get_monthly_leaderboard');
            if (rankError) throw rankError;

            const ranking = rankingData || [];
            setLeaderboard(ranking);

            // 2. BUSCA SEGURA DE PONTOS (Correção do bug)
            const { data: pointsData, error: pointsError } = await supabase.rpc('get_my_monthly_points');
            if (!pointsError) {
                setMyPoints(pointsData || 0);
            }

            // 3. Buscar perfil atualizado (Nome e Foto)
            const { data: profileData } = await supabase
                .from('profiles')
                .select('display_name, avatar_url')
                .eq('id', user!.id)
                .single();

            if (profileData) {
                setMyProfile({
                    name: profileData.display_name || "Você",
                    avatar: profileData.avatar_url || ""
                });
            }

            // 4. Calcular Rank
            const meInLeaderboard = ranking.find((item: LeaderboardItem) => item.user_id === user!.id);
            if (meInLeaderboard) {
                setMyRank(meInLeaderboard.rank);
            }

        } catch (error) {
            console.error("Erro ao carregar gamificação:", error);
        } finally {
            setLoading(false);
        }
    };

    const topThree = leaderboard.slice(0, 3);
    const restOfList = leaderboard.slice(3);
    const progress = Math.min((myPoints / TARGET_POINTS) * 100, 100);

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex flex-col pb-24">
            {/* Background Decorativo */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-600 via-purple-600 to-background rounded-b-[4rem] shadow-2xl z-0" />

            <div className="absolute top-10 left-10 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute top-20 right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-700" />

            <div className="relative z-10 flex-1 flex flex-col">

                {/* Header */}
                <header className="px-6 py-6 flex items-center justify-between text-white">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium opacity-80 uppercase tracking-wider">Desafio Mensal</span>
                        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                            Mestre da Economia <Flame className="w-5 h-5 text-orange-400 fill-orange-400 animate-pulse" />
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate("/configuracoes")} // Link para Configurações
                            className="text-white/80 hover:text-white hover:bg-white/10"
                        >
                            <Settings className="w-6 h-6" />
                        </Button>
                        <AppMenu triggerClassName="text-white/80 hover:text-white hover:bg-white/10" />
                    </div>
                </header>

                {/* Card de Status do Usuário (Hero) */}
                <div className="px-6 mb-8">
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-300 to-orange-500 p-[3px] shadow-lg">
                                        <Avatar className="w-full h-full border-2 border-white/20">
                                            <AvatarImage src={myProfile?.avatar} className="object-cover" />
                                            <AvatarFallback>EU</AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="absolute -bottom-2 -right-1 bg-indigo-900 text-white text-xs font-bold px-2 py-0.5 rounded-full border border-white/20 shadow-sm">
                                        #{myRank}
                                    </div>
                                </div>
                                <div>
                                    {loading ? (
                                        <Loader2 className="w-6 h-6 animate-spin mb-2" />
                                    ) : (
                                        <p className="text-3xl font-bold tracking-tight animate-fade-in">
                                            {myPoints}
                                        </p>
                                    )}
                                    <p className="text-indigo-200 text-sm font-medium">
                                        {myProfile?.name || "Meus ListCoins"}
                                    </p>
                                </div>
                            </div>
                            <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center border border-white/10">
                                <Trophy className="w-6 h-6 text-yellow-300" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-medium text-indigo-200">
                                <span>Progresso para o prêmio</span>
                                <span>{progress.toFixed(0)}%</span>
                            </div>
                            <div className="h-4 bg-black/20 rounded-full overflow-hidden p-0.5 backdrop-blur-sm">
                                <div
                                    className="h-full bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-500 rounded-full shadow-[0_0_15px_rgba(251,146,60,0.6)] transition-all duration-1000 ease-out relative"
                                    style={{ width: `${progress}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_2s_infinite]" />
                                </div>
                            </div>
                            <p className="text-xs text-center mt-2 text-white/80 flex items-center justify-center gap-1">
                                <Target className="w-3 h-3" />
                                Faltam <strong>{Math.max(0, TARGET_POINTS - myPoints)}</strong> pontos para o Vale iFood R$100
                            </p>
                        </div>
                    </div>
                </div>

                {/* Podium Section */}
                <div className="px-4 mb-6">
                    <div className="flex items-end justify-center gap-3 h-48">
                        {/* 2º Lugar */}
                        <div className="flex flex-col items-center gap-2 w-1/3">
                            <div className="relative">
                                <Avatar className="w-14 h-14 border-4 border-slate-300 shadow-lg">
                                    <AvatarImage src={topThree[1]?.avatar_url} />
                                    <AvatarFallback>2</AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-2 inset-x-0 flex justify-center">
                                    <span className="bg-slate-300 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">2º</span>
                                </div>
                            </div>
                            <div className="h-24 w-full bg-slate-300/20 backdrop-blur-sm rounded-t-2xl border-t border-x border-white/20 flex flex-col items-center justify-end p-2 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent" />
                                <p className="text-white font-bold relative z-10 text-sm truncate w-full text-center">{topThree[1]?.display_name || "---"}</p>
                                <p className="text-slate-200 text-xs relative z-10">{topThree[1]?.total_points || 0}</p>
                            </div>
                        </div>

                        {/* 1º Lugar */}
                        <div className="flex flex-col items-center gap-2 w-1/3 relative -top-2">
                            <Crown className="w-8 h-8 text-yellow-300 fill-yellow-300 animate-bounce absolute -top-10" />
                            <div className="relative">
                                <Avatar className="w-20 h-20 border-4 border-yellow-400 shadow-xl ring-4 ring-yellow-400/20">
                                    <AvatarImage src={topThree[0]?.avatar_url} />
                                    <AvatarFallback>1</AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-3 inset-x-0 flex justify-center">
                                    <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-0.5 rounded-full shadow-md">1º</span>
                                </div>
                            </div>
                            <div className="h-32 w-full bg-gradient-to-b from-yellow-400/30 to-yellow-600/10 backdrop-blur-md rounded-t-2xl border-t border-x border-yellow-400/30 flex flex-col items-center justify-end p-3 relative overflow-hidden shadow-[0_0_30px_rgba(250,204,21,0.2)]">
                                <div className="absolute inset-0 bg-gradient-to-t from-yellow-900/40 to-transparent" />
                                <p className="text-white font-bold relative z-10 text-base truncate w-full text-center">{topThree[0]?.display_name || "Vago"}</p>
                                <p className="text-yellow-100 text-sm relative z-10 font-medium">{topThree[0]?.total_points || 0} pts</p>
                            </div>
                        </div>

                        {/* 3º Lugar */}
                        <div className="flex flex-col items-center gap-2 w-1/3">
                            <div className="relative">
                                <Avatar className="w-14 h-14 border-4 border-orange-400 shadow-lg">
                                    <AvatarImage src={topThree[2]?.avatar_url} />
                                    <AvatarFallback>3</AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-2 inset-x-0 flex justify-center">
                                    <span className="bg-orange-400 text-orange-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">3º</span>
                                </div>
                            </div>
                            <div className="h-20 w-full bg-orange-700/20 backdrop-blur-sm rounded-t-2xl border-t border-x border-white/20 flex flex-col items-center justify-end p-2 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-t from-orange-900/40 to-transparent" />
                                <p className="text-white font-bold relative z-10 text-sm truncate w-full text-center">{topThree[2]?.display_name || "---"}</p>
                                <p className="text-orange-200 text-xs relative z-10">{topThree[2]?.total_points || 0}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lista Restante */}
                <div className="flex-1 bg-card rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] -mt-4 relative z-20 pb-24 overflow-hidden flex flex-col">
                    <div className="p-6 pb-2">
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            Competidores
                        </h3>
                    </div>

                    <div className="overflow-y-auto flex-1 px-4 space-y-3 pb-4 scrollbar-hide">
                        {loading ? (
                            [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
                        ) : restOfList.length === 0 && topThree.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                <Medal className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>O ranking recomeçou este mês.<br />Seja o primeiro!</p>
                            </div>
                        ) : (
                            restOfList.map((player) => (
                                <div
                                    key={player.user_id}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-2xl border transition-all duration-200",
                                        player.user_id === user?.id
                                            ? "bg-indigo-50 border-indigo-200 shadow-sm scale-[1.02]"
                                            : "bg-background border-border hover:border-primary/20"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-muted-foreground font-bold w-6 text-center text-sm">#{player.rank}</span>
                                        <Avatar className="w-10 h-10 border border-border">
                                            <AvatarImage src={player.avatar_url} />
                                            <AvatarFallback>{player.rank}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className={cn("text-sm font-semibold", player.user_id === user?.id ? "text-indigo-700" : "text-foreground")}>
                                                {player.user_id === user?.id ? (myProfile?.name || "Você") : player.display_name}
                                            </span>
                                            {player.user_id === user?.id && (
                                                <span className="text-[10px] text-indigo-500 font-medium">Continue assim!</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-secondary/50 px-3 py-1.5 rounded-xl">
                                        <span className="font-bold text-foreground text-sm">{player.total_points}</span>
                                        <span className="text-[10px] text-muted-foreground ml-1">pts</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>

            <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent z-50">
                <Button
                    onClick={() => navigate("/listas")}
                    size="lg"
                    className="w-full h-16 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-xl shadow-indigo-500/25 flex items-center justify-between px-6 text-lg font-bold group transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <span className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl group-hover:rotate-12 transition-transform">
                            <Plus className="w-6 h-6" />
                        </div>
                        Minhas Listas
                    </span>
                    <div className="flex items-center gap-2 text-sm font-normal opacity-90">
                        <span>+50 pts</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                </Button>
            </div>
        </div>
    );
}
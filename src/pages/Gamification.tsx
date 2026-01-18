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
    Settings,
    Info,
    CalendarCheck,
    Gift,
    Users // <--- ADICIONADO O IMPORT QUE FALTAVA
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
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

interface LeaderboardItem {
    user_id: string;
    display_name: string;
    avatar_url?: string;
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
    const [myProfile, setMyProfile] = useState<{ name: string, avatar: string | null } | null>(null);

    const [isRulesOpen, setIsRulesOpen] = useState(false);

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

            // 2. BUSCA SEGURA DE PONTOS
            const { data: pointsData, error: pointsError } = await supabase.rpc('get_my_monthly_points');
            if (!pointsError) {
                setMyPoints(pointsData || 0);
            }

            // 3. Buscar perfil atualizado
            const { data: profileData } = await supabase
                .from('profiles')
                .select('display_name, avatar_url')
                .eq('id', user!.id)
                .single();

            if (profileData) {
                setMyProfile({
                    name: profileData.display_name || "Você",
                    avatar: profileData.avatar_url // Pode ser null
                });
            }

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
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate("/configuracoes")}
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
                                        <Avatar className="w-full h-full border-2 border-white/20 overflow-hidden">
                                            <AvatarImage src={myProfile?.avatar || undefined} className="object-cover w-full h-full" />
                                            <AvatarFallback className="bg-indigo-800 text-white">EU</AvatarFallback>
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

                        <div className="space-y-3">
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

                            {/* Botão de Regras dentro do Card */}
                            <button
                                onClick={() => setIsRulesOpen(true)}
                                className="w-full mt-2 py-2 px-3 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center gap-2 transition-all group border border-white/5"
                            >
                                <Info className="w-4 h-4 text-yellow-300 group-hover:scale-110 transition-transform" />
                                <span className="text-xs text-white/90 font-medium">
                                    Faltam <strong>{Math.max(0, TARGET_POINTS - myPoints)}</strong> pts. Como ganhar?
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Podium Section - CORRIGIDO: Sempre mostra o pódio, mesmo vazio */}
                <div className="px-4 mb-6">
                    <div className="flex items-end justify-center gap-3 h-48">

                        {/* 2º Lugar */}
                        <div className="flex flex-col items-center gap-2 w-1/3">
                            <div className="relative">
                                <Avatar className="w-14 h-14 border-4 border-slate-300 shadow-lg bg-slate-100 overflow-hidden">
                                    <AvatarImage src={topThree[1]?.avatar_url || undefined} className="object-cover w-full h-full" />
                                    <AvatarFallback className="bg-slate-200 text-slate-400 font-bold">2</AvatarFallback>
                                </Avatar>
                                {topThree[1] && (
                                    <div className="absolute -bottom-2 inset-x-0 flex justify-center">
                                        <span className="bg-slate-300 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">2º</span>
                                    </div>
                                )}
                            </div>
                            <div className="h-24 w-full bg-slate-300/20 backdrop-blur-sm rounded-t-2xl border-t border-x border-white/20 flex flex-col items-center justify-end p-2 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent" />
                                <p className="text-white font-bold relative z-10 text-sm truncate w-full text-center">
                                    {topThree[1]?.display_name || "-"}
                                </p>
                                <p className="text-slate-200 text-xs relative z-10">
                                    {topThree[1]?.total_points || 0}
                                </p>
                            </div>
                        </div>

                        {/* 1º Lugar */}
                        <div className="flex flex-col items-center gap-2 w-1/3 relative -top-2">
                            <Crown className="w-8 h-8 text-yellow-300 fill-yellow-300 animate-bounce absolute -top-10" />
                            <div className="relative">
                                <Avatar className="w-20 h-20 border-4 border-yellow-400 shadow-xl ring-4 ring-yellow-400/20 bg-yellow-50 overflow-hidden">
                                    <AvatarImage src={topThree[0]?.avatar_url || undefined} className="object-cover w-full h-full" />
                                    <AvatarFallback className="bg-yellow-100 text-yellow-600 font-bold">1</AvatarFallback>
                                </Avatar>
                                {topThree[0] && (
                                    <div className="absolute -bottom-3 inset-x-0 flex justify-center">
                                        <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-0.5 rounded-full shadow-md">1º</span>
                                    </div>
                                )}
                            </div>
                            <div className="h-32 w-full bg-gradient-to-b from-yellow-400/30 to-yellow-600/10 backdrop-blur-md rounded-t-2xl border-t border-x border-yellow-400/30 flex flex-col items-center justify-end p-3 relative overflow-hidden shadow-[0_0_30px_rgba(250,204,21,0.2)]">
                                <div className="absolute inset-0 bg-gradient-to-t from-yellow-900/40 to-transparent" />
                                <p className="text-white font-bold relative z-10 text-base truncate w-full text-center">
                                    {topThree[0]?.display_name || "Vago"}
                                </p>
                                <p className="text-yellow-100 text-sm relative z-10 font-medium">
                                    {topThree[0]?.total_points || 0} pts
                                </p>
                            </div>
                        </div>

                        {/* 3º Lugar */}
                        <div className="flex flex-col items-center gap-2 w-1/3">
                            <div className="relative">
                                <Avatar className="w-14 h-14 border-4 border-orange-400 shadow-lg bg-orange-50 overflow-hidden">
                                    <AvatarImage src={topThree[2]?.avatar_url || undefined} className="object-cover w-full h-full" />
                                    <AvatarFallback className="bg-orange-100 text-orange-600 font-bold">3</AvatarFallback>
                                </Avatar>
                                {topThree[2] && (
                                    <div className="absolute -bottom-2 inset-x-0 flex justify-center">
                                        <span className="bg-orange-400 text-orange-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">3º</span>
                                    </div>
                                )}
                            </div>
                            <div className="h-20 w-full bg-orange-700/20 backdrop-blur-sm rounded-t-2xl border-t border-x border-white/20 flex flex-col items-center justify-end p-2 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-t from-orange-900/40 to-transparent" />
                                <p className="text-white font-bold relative z-10 text-sm truncate w-full text-center">
                                    {topThree[2]?.display_name || "-"}
                                </p>
                                <p className="text-orange-200 text-xs relative z-10">
                                    {topThree[2]?.total_points || 0}
                                </p>
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
                        ) : restOfList.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground opacity-60">
                                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">Mais competidores aparecerão aqui.</p>
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
                                        <Avatar className="w-10 h-10 border border-border overflow-hidden">
                                            <AvatarImage src={player.avatar_url || undefined} className="object-cover w-full h-full" />
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

            {/* MODAL DE REGRAS */}
            <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
                <DialogContent className="w-[90%] max-w-sm rounded-2xl p-6 bg-white/95 backdrop-blur-md border-white/20">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold text-indigo-900">
                            <Target className="w-6 h-6 text-indigo-600" />
                            Como Ganhar o Prêmio?
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-start gap-3">
                            <Gift className="w-8 h-8 text-indigo-600 shrink-0 mt-1" />
                            <div>
                                <h4 className="font-bold text-indigo-900">Vale iFood </h4>
                                <p className="text-sm text-indigo-700 leading-tight mt-1">
                                    O primeiro jogador a atingir <strong>200 pontos</strong> no mês leva o prêmio!
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Regras de Pontuação:</h4>

                            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                                <div className="bg-green-100 p-2 rounded-full">
                                    <CalendarCheck className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800">+50 Pontos</p>
                                    <p className="text-xs text-gray-600">Por semana ao finalizar uma lista.</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                <p>
                                    Para pontuar, a lista deve ter preços reais preenchidos no mercado.
                                    Limitado a uma pontuação válida por semana (reset toda segunda-feira).
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-12"
                            onClick={() => setIsRulesOpen(false)}
                        >
                            Entendi, vamos lá!
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
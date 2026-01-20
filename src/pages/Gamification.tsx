import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Trophy,
    Target,
    Flame,
    Loader2,
    Gift,
    MapPin,
    ChevronRight,
    Star,
    ShieldAlert,
    TrendingUp,
    AlertTriangle,
    Crown,
    X
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
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

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
}

export default function Gamification() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    const [loading, setLoading] = useState(true);
    const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
    const [myPoints, setMyPoints] = useState(0);
    const [myRank, setMyRank] = useState<number>(0);
    const [alerts, setAlerts] = useState<QuickAlert[]>([]);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [isRulesOpen, setIsRulesOpen] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) navigate("/auth");
    }, [user, authLoading, navigate]);

    useEffect(() => {
        if (user) loadData();
    }, [user]);

    const loadData = async () => {
        if (leaderboard.length === 0) setLoading(true);
        try {
            const [rankingResult, pointsResult, alertsResult, missionsResult, notifsResult, territoriesResult] = await Promise.all([
                supabase.rpc('get_monthly_leaderboard'),
                supabase.rpc('get_my_monthly_points', { target_user_id: user!.id }),
                supabase.from('price_alerts')
                    .select('id, product_name, price, created_at, markets(name)')
                    .order('created_at', { ascending: false })
                    .limit(3),
                supabase.from('missions')
                    .select('*')
                    .eq('is_active', true),
                supabase.from('notifications')
                    .select('*')
                    .eq('user_id', user!.id)
                    .eq('read', false)
                    .order('created_at', { ascending: false }),
                // Buscar Territórios onde tenho score > 0
                // (Idealmente filtraríamos apenas onde sou top 1 no backend, mas faremos no front para simplificar a query agora)
                supabase.from('market_scores')
                    .select('market_id, score, markets(name)')
                    .eq('user_id', user!.id)
                    .gt('score', 0)
                    .order('score', { ascending: false })
            ]);

            if (rankingResult.data) {
                // @ts-ignore
                setLeaderboard(rankingResult.data || []);
                // @ts-ignore
                const me = rankingResult.data.find((r: any) => r.user_id === user!.id);
                if (me) setMyRank(me.my_rank);
            }

            setMyPoints(pointsResult.data || 0);

            if (alertsResult.data) {
                setAlerts(alertsResult.data.map((a: any) => ({
                    id: a.id,
                    product_name: a.product_name,
                    price: a.price,
                    market_name: a.markets?.name || 'Mercado',
                    created_at: a.created_at
                })) || []);
            }

            if (missionsResult.data) {
                // @ts-ignore
                setMissions(missionsResult.data || []);
            }

            if (notifsResult.data) {
                // @ts-ignore
                setNotifications(notifsResult.data || []);
            }

            if (territoriesResult.data) {
                // Mapeia para interface
                const myTerritories = territoriesResult.data.map((t: any) => ({
                    market_id: t.market_id,
                    score: t.score,
                    market_name: t.markets?.name
                }));
                setTerritories(myTerritories);
            }

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

    if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

    const topThree = leaderboard.slice(0, 3);
    const restOfRanking = leaderboard.slice(3, 10);

    return (
        <div className="min-h-screen bg-gray-50/50 pb-32">
            <header className="px-6 pt-8 pb-4 bg-white sticky top-0 z-30 border-b border-gray-100/50 backdrop-blur-md bg-white/80">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                        <h1 className="text-xl font-display font-bold text-gray-900">Arena de Pontos</h1>
                    </div>
                    <AppMenu />
                </div>
            </header>

            <main className="px-5 pt-6 space-y-8">

                {/* 0. NOTIFICAÇÕES */}
                {notifications.length > 0 && (
                    <div className="space-y-2 animate-slide-up">
                        {notifications.map(n => (
                            <div key={n.id} className={cn("p-3 rounded-xl border flex gap-3 items-start relative shadow-sm", n.type === 'warning' ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200")}>
                                <div className={cn("p-1.5 rounded-full shrink-0", n.type === 'warning' ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>
                                    {n.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> : <Crown className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 pr-6">
                                    <h4 className={cn("text-sm font-bold", n.type === 'warning' ? "text-yellow-900" : "text-red-900")}>{n.title}</h4>
                                    <p className={cn("text-xs leading-relaxed mt-0.5", n.type === 'warning' ? "text-yellow-800" : "text-red-800")}>{n.message}</p>
                                </div>
                                <button onClick={() => markAsRead(n.id)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-black/5 rounded-full transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* 1. CARD DE STATUS (SKELETON FIXO) */}
                <section className="relative min-h-[220px]">
                    {loading && leaderboard.length === 0 ? (
                        <div className="w-full h-[220px] rounded-xl bg-gray-200 animate-pulse" />
                    ) : (
                        <Card className="border-none shadow-xl shadow-indigo-500/20 bg-gradient-to-br from-[#4F46E5] to-[#6366f1] text-white overflow-hidden relative animate-fade-in">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                            <CardContent className="p-6 relative z-10">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-none mb-2">Ranking Mensal</Badge>
                                        <h2 className="text-5xl font-display font-bold tracking-tighter">{myPoints}</h2>
                                        <p className="text-indigo-100 text-sm font-medium mt-1">pontos acumulados</p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/10 text-center min-w-[80px]">
                                            <span className="block text-xs text-indigo-200 uppercase tracking-wider font-bold">Posição</span>
                                            <span className="block text-2xl font-bold">#{myRank || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <div className="flex justify-between text-xs text-indigo-100 mb-2">
                                        <span>Próximo nível</span>
                                        <span>Líder: {leaderboard[0]?.total_points || 0} pts</span>
                                    </div>
                                    <Progress value={leaderboard[0] ? (myPoints / leaderboard[0].total_points) * 100 : 0} className="h-2 bg-black/20" indicatorClassName="bg-yellow-400" />
                                    <div className="mt-4 flex items-center gap-2 text-xs text-white/80 cursor-pointer hover:text-white transition-colors" onClick={() => setIsRulesOpen(true)}>
                                        <Gift className="w-4 h-4" />
                                        <span>Tabela de Pontos e Prêmios</span>
                                        <ChevronRight className="w-3 h-3 ml-auto" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </section>

                {/* 1.5 MEUS TERRITÓRIOS (NOVO) */}
                {territories.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <Crown className="w-5 h-5 text-yellow-600 fill-yellow-600" />
                            <h3 className="font-bold text-gray-900">Meus Territórios</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {territories.map(t => (
                                <div key={t.market_id} className="bg-gradient-to-br from-yellow-50 to-white p-3 rounded-xl border border-yellow-200 shadow-sm flex flex-col justify-center items-center text-center cursor-pointer hover:border-yellow-400 transition-colors" onClick={() => navigate(`/ver-mercado/${t.market_id}`)}>
                                    <div className="bg-yellow-100 p-2 rounded-full mb-2">
                                        <Crown className="w-4 h-4 text-yellow-700 fill-yellow-700" />
                                    </div>
                                    <h4 className="font-bold text-xs text-gray-900 line-clamp-1">{t.market_name}</h4>
                                    <span className="text-[10px] text-yellow-800 font-bold mt-1">{t.score} pts</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 2. MISSÕES (SKELETON FIXO) */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Target className="w-5 h-5 text-indigo-600" />
                        <h3 className="font-bold text-gray-900">Missões Ativas</h3>
                    </div>
                    <div className="space-y-3">
                        {loading && missions.length === 0 ? (
                            <>
                                <div className="h-20 w-full bg-gray-200 rounded-2xl animate-pulse" />
                                <div className="h-20 w-full bg-gray-200 rounded-2xl animate-pulse" />
                            </>
                        ) : (
                            missions.map((mission) => (
                                <div key={mission.id} onClick={() => navigate(mission.action_link)} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 active:scale-98 transition-transform cursor-pointer group hover:border-indigo-100 animate-slide-up">
                                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", mission.icon === 'cart' ? "bg-blue-50 text-blue-600" : mission.icon === 'community' ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600")}>
                                        {mission.icon === 'cart' && <Target className="w-6 h-6" />}
                                        {mission.icon === 'community' && <Flame className="w-6 h-6" />}
                                        {mission.icon === 'price' && <TrendingUp className="w-6 h-6" />}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors">{mission.title}</h4>
                                        <p className="text-xs text-gray-500">{mission.description}</p>
                                    </div>
                                    <Badge className="bg-gray-900 text-white border-none">+{mission.reward_points}</Badge>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* 3. ALERTAS (SKELETON FIXO) */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-red-500" />
                            <h3 className="font-bold text-gray-900">Validar Ofertas</h3>
                        </div>
                        <Button variant="link" className="text-xs h-auto p-0" onClick={() => navigate('/comunidade')}>Ver todas</Button>
                    </div>
                    <div className="grid gap-3">
                        {loading && alerts.length === 0 ? (
                            <div className="h-16 w-full bg-gray-200 rounded-xl animate-pulse" />
                        ) : alerts.length > 0 ? (
                            alerts.map(alert => (
                                <div key={alert.id} onClick={() => navigate('/comunidade')} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer active:bg-gray-50 animate-slide-up">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-red-50 w-10 h-10 rounded-full flex items-center justify-center text-red-500 font-bold text-xs">R$</div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{alert.product_name}</p>
                                            <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {alert.market_name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="block font-bold text-green-700">R$ {alert.price.toFixed(2)}</span>
                                        <Badge variant="outline" className="text-[10px] h-5 border-green-200 text-green-700 bg-green-50">+10 pts</Badge>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-sm text-gray-400 py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                Nenhuma oferta recente para validar.
                            </div>
                        )}
                    </div>
                </section>

                {/* 4. LEADERBOARD (SKELETON FIXO) */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Flame className="w-5 h-5 text-orange-500" />
                        <h3 className="font-bold text-gray-900">Top Jogadores</h3>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[300px]">
                        {loading && leaderboard.length === 0 ? (
                            <div className="p-6 space-y-4">
                                <div className="flex justify-center items-end gap-4 h-32">
                                    <div className="w-16 h-20 bg-gray-200 rounded-t-lg animate-pulse" />
                                    <div className="w-16 h-28 bg-gray-200 rounded-t-lg animate-pulse" />
                                    <div className="w-16 h-16 bg-gray-200 rounded-t-lg animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                                    <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-center items-end gap-4 py-6 bg-gradient-to-b from-orange-50/50 to-white border-b border-gray-50">
                                    {/* 2nd Place */}
                                    {topThree[1] && (
                                        <div className="flex flex-col items-center">
                                            <Avatar className="w-12 h-12 border-2 border-gray-200 shrink-0">
                                                <AvatarImage src={topThree[1].avatar_url} className="object-cover h-full w-full" />
                                                <AvatarFallback>{topThree[1].display_name[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs font-bold mt-1 text-gray-600">{topThree[1].display_name.split(' ')[0]}</span>
                                            <span className="text-[10px] text-gray-400 font-bold">{topThree[1].total_points}</span>
                                            <div className="mt-1 bg-gray-200 text-gray-600 text-[10px] font-bold px-2 rounded-full">#2</div>
                                        </div>
                                    )}

                                    {/* 1st Place */}
                                    {topThree[0] && (
                                        <div className="flex flex-col items-center -mt-4">
                                            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400 animate-pulse mb-1" />
                                            <Avatar className="w-16 h-16 border-4 border-yellow-400 shadow-lg shrink-0">
                                                <AvatarImage src={topThree[0].avatar_url} className="object-cover h-full w-full" />
                                                <AvatarFallback>{topThree[0].display_name[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm font-bold mt-1 text-gray-900">{topThree[0].display_name.split(' ')[0]}</span>
                                            <span className="text-xs text-yellow-600 font-bold">{topThree[0].total_points} pts</span>
                                            <div className="mt-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-0.5 rounded-full shadow-sm">#1</div>
                                        </div>
                                    )}

                                    {/* 3rd Place */}
                                    {topThree[2] && (
                                        <div className="flex flex-col items-center">
                                            <Avatar className="w-12 h-12 border-2 border-orange-200 shrink-0">
                                                <AvatarImage src={topThree[2].avatar_url} className="object-cover h-full w-full" />
                                                <AvatarFallback>{topThree[2].display_name[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs font-bold mt-1 text-gray-600">{topThree[2].display_name.split(' ')[0]}</span>
                                            <span className="text-[10px] text-gray-400 font-bold">{topThree[2].total_points}</span>
                                            <div className="mt-1 bg-orange-100 text-orange-700 text-[10px] font-bold px-2 rounded-full">#3</div>
                                        </div>
                                    )}
                                </div>

                                <div className="divide-y divide-gray-50">
                                    {restOfRanking.map((player) => (
                                        <div key={player.user_id} className={cn("flex items-center justify-between p-4", player.user_id === user?.id && "bg-indigo-50")}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-bold text-gray-400 w-6">#{player.my_rank}</span>
                                                <Avatar className="w-8 h-8 shrink-0">
                                                    <AvatarImage src={player.avatar_url} className="object-cover h-full w-full" />
                                                    <AvatarFallback>{player.display_name[0]}</AvatarFallback>
                                                </Avatar>
                                                <span className={cn("text-sm font-medium", player.user_id === user?.id ? "text-indigo-700 font-bold" : "text-gray-700")}>
                                                    {player.display_name} {player.user_id === user?.id && "(Você)"}
                                                </span>
                                            </div>
                                            <span className="text-sm font-bold text-gray-900">{player.total_points}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </section>
            </main>

            <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Tabela de Pontuação</DialogTitle></DialogHeader>
                    <div className="mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ação</TableHead>
                                    <TableHead className="text-right">Pontos</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">Finalizar Compra</TableCell>
                                    <TableCell className="text-right text-green-600 font-bold">+100</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Cadastrar Preço (por item)</TableCell>
                                    <TableCell className="text-right text-green-600 font-bold">+5</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Postar Alerta (Você)</TableCell>
                                    <TableCell className="text-right text-blue-600 font-bold">+5</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Seu Alerta Confirmado</TableCell>
                                    <TableCell className="text-right text-indigo-600 font-bold">+15 (Bônus)</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">Validar Oferta (GPS)</TableCell>
                                    <TableCell className="text-right text-green-600 font-bold">+10</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium text-red-500">Apagar Post (&lt;48h)</TableCell>
                                    <TableCell className="text-right text-red-500 font-bold">-5</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                        <p className="text-xs text-muted-foreground mt-4 text-center">O jogador com mais pontos no fim do mês ganha o vale iFood!</p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
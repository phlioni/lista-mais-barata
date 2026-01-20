import { useEffect, useState } from "react";
import { Crown, Trophy, TrendingUp, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface MarketOwnerCardProps {
    marketId: string;
}

interface MarketOwner {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
    score: number;
}

export function MarketOwnerCard({ marketId }: MarketOwnerCardProps) {
    const { user } = useAuth();
    const [owner, setOwner] = useState<MarketOwner | null>(null);
    const [myScore, setMyScore] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    // Cache busting para avatares
    const timestamp = new Date().getTime();

    useEffect(() => {
        if (marketId && user) {
            fetchData();
        }
    }, [marketId, user]);

    const fetchData = async () => {
        try {
            // 1. Busca o dono atual via RPC
            const { data: ownerData } = await supabase.rpc("get_market_owner", {
                target_market_id: marketId,
            });

            if (ownerData && ownerData.length > 0) {
                setOwner(ownerData[0]);
            }

            // 2. Busca minha pontuação neste mercado
            const { data: myData } = await supabase
                .from("market_scores")
                .select("score")
                .eq("market_id", marketId)
                .eq("user_id", user!.id)
                .maybeSingle();

            if (myData) {
                setMyScore(myData.score);
            }
        } catch (error) {
            console.error("Erro ao buscar dados do território:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return null;

    // Cenário 1: Ninguém domina ainda
    if (!owner) {
        return (
            <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-dashed border-2 border-gray-200 p-4 mb-4">
                <div className="flex items-center gap-4">
                    <div className="bg-gray-200 p-3 rounded-full">
                        <Trophy className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-700 text-sm">Território sem dono!</h3>
                        <p className="text-xs text-muted-foreground">
                            Seja o primeiro a atualizar preços aqui e torne-se o Barão deste mercado.
                        </p>
                    </div>
                </div>
            </Card>
        );
    }

    const isMe = owner.user_id === user?.id;
    const progressToOvertake = owner.score > 0 ? (myScore / owner.score) * 100 : 0;
    const pointsNeeded = owner.score - myScore;

    // Cenário 2: Eu sou o dono
    if (isMe) {
        return (
            <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 p-4 mb-6 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Crown className="w-24 h-24 text-yellow-600 rotate-12" />
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <div className="relative">
                        <Avatar className="w-16 h-16 border-4 border-yellow-300 shadow-md">
                            <AvatarImage src={`${owner.avatar_url}?t=${timestamp}`} />
                            <AvatarFallback className="bg-yellow-200 text-yellow-700 font-bold">EU</AvatarFallback>
                        </Avatar>
                        <div className="absolute -top-2 -right-1 bg-yellow-400 text-white p-1 rounded-full shadow-sm animate-bounce">
                            <Crown className="w-4 h-4 fill-current" />
                        </div>
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-yellow-900 leading-none">Você manda aqui!</h3>
                            <span className="text-[10px] bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                Barão
                            </span>
                        </div>
                        <p className="text-xs text-yellow-700 font-medium mb-2">
                            {myScore} pontos de influência acumulados.
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-yellow-800/80 bg-yellow-100/50 p-2 rounded-lg border border-yellow-200/50">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Continue verificando preços para manter seu reinado.</span>
                        </div>
                    </div>
                </div>
            </Card>
        );
    }

    // Cenário 3: Outra pessoa é dona (Rivalidade)
    return (
        <Card className="bg-white border-indigo-100 p-4 mb-6 shadow-sm relative overflow-hidden">
            {/* Barra de progresso sutil no topo */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
                <div
                    className="h-full bg-indigo-500 transition-all duration-1000"
                    style={{ width: `${Math.min(progressToOvertake, 100)}%` }}
                />
            </div>

            <div className="flex justify-between items-start mt-2">
                <div className="flex gap-3">
                    <Avatar className="w-12 h-12 border-2 border-gray-100">
                        <AvatarImage src={`${owner.avatar_url}?t=${timestamp}`} />
                        <AvatarFallback>{owner.display_name?.[0]}</AvatarFallback>
                    </Avatar>

                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-0.5">
                            Território dominado por
                        </p>
                        <h3 className="font-bold text-gray-900 text-base flex items-center gap-1.5">
                            {owner.display_name}
                            <Crown className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                        </h3>
                        <p className="text-xs text-indigo-600 font-medium mt-1">
                            {owner.score} pontos de influência
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    <span className="text-2xl font-bold text-gray-900 block">{myScore}</span>
                    <span className="text-[10px] text-gray-400 uppercase">Seus Pontos</span>
                </div>
            </div>

            <div className="mt-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex justify-between text-xs mb-2 font-medium">
                    <span className="text-gray-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-orange-500" />
                        Disputa Pelo Território
                    </span>
                    <span className="text-indigo-600">Faltam {pointsNeeded} pts</span>
                </div>
                <Progress value={progressToOvertake} className="h-2.5 bg-gray-200" indicatorClassName="bg-indigo-600" />
                <p className="text-[10px] text-gray-400 mt-2 text-center">
                    Faça listas e verifique preços aqui para roubar a liderança!
                </p>
            </div>
        </Card>
    );
}
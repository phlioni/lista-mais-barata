import { useEffect, useState } from "react";
import { User, LogOut, Settings, DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { AppMenu } from "@/components/AppMenu"; // Menu Lateral
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export default function Profile() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    listsCount: 0,
    marketsCount: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    const [listsRes, marketsRes] = await Promise.all([
      supabase.from("shopping_lists").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("markets").select("*", { count: "exact", head: true }),
    ]);

    setStats({
      listsCount: listsRes.count || 0,
      marketsCount: marketsRes.count || 0,
    });
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header Atualizado */}
      <div className="flex items-center justify-between px-4 py-4 max-w-md mx-auto sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Perfil</h1>
          <p className="text-sm text-muted-foreground">Minha conta</p>
        </div>
        <AppMenu />
      </div>

      <main className="px-4 py-6 max-w-md mx-auto space-y-6">
        {/* User Info Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-soft text-center animate-slide-up">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-lg font-bold font-display">{user.email?.split("@")[0]}</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center gap-2 animate-slide-up" style={{ animationDelay: "50ms" }}>
            <span className="text-3xl font-bold font-display text-primary">{stats.listsCount}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Listas Criadas</span>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center gap-2 animate-slide-up" style={{ animationDelay: "100ms" }}>
            <span className="text-3xl font-bold font-display text-primary">{stats.marketsCount}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Mercados</span>
          </div>
        </div>

        {/* Menu Actions */}
        <div className="space-y-3 animate-slide-up" style={{ animationDelay: "150ms" }}>
          <Button
            variant="outline"
            className="w-full h-14 justify-start px-4 rounded-xl border-border bg-card hover:bg-secondary/50"
            onClick={() => navigate("/precos")}
          >
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center mr-3">
              <DollarSign className="w-4 h-4 text-green-600" />
            </div>
            Gerenciar Preços
          </Button>

          <Button
            variant="outline"
            className="w-full h-14 justify-start px-4 rounded-xl border-border bg-card hover:bg-secondary/50"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mr-3">
              <Settings className="w-4 h-4 text-blue-600" />
            </div>
            Configurações
          </Button>

          <Button
            variant="outline"
            className="w-full h-14 justify-start px-4 rounded-xl border-border bg-card hover:bg-destructive/5 text-destructive hover:text-destructive hover:border-destructive/30"
            onClick={() => signOut()}
          >
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center mr-3">
              <LogOut className="w-4 h-4 text-destructive" />
            </div>
            Sair da conta
          </Button>
        </div>
      </main>
    </div>
  );
}
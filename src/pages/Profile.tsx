import { LogOut, User, DollarSign, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export default function Profile() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Perfil" />

      <main className="px-4 py-4 max-w-md mx-auto">
        {/* User Info */}
        <div className="bg-card rounded-2xl border border-border shadow-soft p-6 mb-6 animate-slide-up">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-semibold text-lg text-foreground">Usuário</h2>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Menu Options */}
        <div className="space-y-2 mb-6">
          <Link
            to="/precos"
            className={cn(
              "flex items-center gap-4 p-4 bg-card rounded-2xl border border-border",
              "transition-all duration-200 hover:shadow-soft hover:border-primary/20"
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground">Gerenciar Preços</h3>
              <p className="text-sm text-muted-foreground">Adicionar preços aos mercados</p>
            </div>
          </Link>
        </div>

        {/* Sign Out */}
        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-5 h-5" />
          Sair da Conta
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}

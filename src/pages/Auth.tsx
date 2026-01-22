import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Leaf, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const authSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignUpCheck = async () => {
    try {
      // 1. Verificar limite de usuários (100 vagas)
      // Mantivemos esta checagem de segurança, mas removemos a restrição de cidade
      const { data: userCount, error: countError } = await supabase.rpc('get_beta_user_count');

      if (countError) {
        console.error("Erro ao verificar contagem:", countError);
        // Em caso de erro técnico, permitimos tentar
      } else if (typeof userCount === 'number' && userCount >= 100) {
        toast({
          title: "Vagas Esgotadas no Momento",
          description: "Agradecemos o interesse! No momento atingimos o limite de 100 usuários beta. Em breve abriremos mais vagas.",
          variant: "destructive",
          duration: 6000,
        });
        return false;
      }

      // Geolocalização removida para liberar acesso geral
      return true;

    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
    const result = authSchema.safeParse({ email, password });
    if (!result.success) {
      const firstError = result.error.errors[0];
      toast({
        title: "Erro de validação",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Se for cadastro, faz as verificações antes
    if (!isLogin) {
      const canProceed = await handleSignUpCheck();
      if (!canProceed) {
        setLoading(false);
        return;
      }
    }

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          let message = "Erro ao fazer login";
          if (error.message.includes("Invalid login credentials")) {
            message = "Email ou senha incorretos";
          }
          toast({
            title: "Erro",
            description: message,
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Bem-vindo!",
          description: "Login realizado com sucesso",
        });
        navigate("/");
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          let message = "Erro ao criar conta";
          if (error.message.includes("already registered")) {
            message = "Este email já está cadastrado";
          }
          if (error.message.includes("Limite de usuários beta")) {
            message = "Infelizmente atingimos o limite de 100 usuários beta.";
          }
          toast({
            title: "Erro",
            description: message,
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Conta criada!",
          description: "Você já pode começar a usar o app",
        });
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-elevated">
            <ShoppingCart className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Lista Certa</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Leaf className="w-4 h-4 text-primary" />
              Economize sempre
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="w-full max-w-sm animate-slide-up">
          <div className="bg-card rounded-2xl border border-border shadow-card p-6">
            <h2 className="text-lg font-display font-semibold text-foreground mb-1">
              {isLogin ? "Entrar na conta" : "Criar conta"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {isLogin
                ? "Faça login para acessar suas listas"
                : "Crie sua conta para começar"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12 rounded-xl"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? "Entrar" : "Criar conta"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin
                  ? "Não tem conta? Criar agora"
                  : "Já tem conta? Fazer login"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 text-center">
        <p className="text-xs text-muted-foreground">
          Compare preços e economize nas compras do mercado
        </p>
      </div>
    </div>
  );
}
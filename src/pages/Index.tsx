import { useState, useEffect } from "react";
import { Plus, ShoppingBag, Loader2, ArrowLeft, Target, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppMenu } from "@/components/AppMenu";
import { ListCard } from "@/components/ListCard";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ShoppingList {
  id: string;
  name: string;
  status: string;
  created_at: string;
  item_count: number;
}

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Estado para missões
  const [activeMissionsCount, setActiveMissionsCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchLists();
      checkActiveMissions();
    }
  }, [user]);

  const checkActiveMissions = async () => {
    const { count } = await supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (count) setActiveMissionsCount(count);
  };

  const fetchLists = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: listsData, error: listsError } = await supabase
        .from("shopping_lists")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (listsError) throw listsError;

      if (!listsData || listsData.length === 0) {
        setLists([]);
        setLoading(false);
        return;
      }

      const listIds = listsData.map((l) => l.id);

      const { data: allItems, error: itemsError } = await supabase
        .from("list_items")
        .select("list_id")
        .in("list_id", listIds);

      if (itemsError) throw itemsError;

      const counts: Record<string, number> = {};
      allItems?.forEach((item) => {
        counts[item.list_id] = (counts[item.list_id] || 0) + 1;
      });

      const listsWithCounts = listsData.map((list) => ({
        ...list,
        item_count: counts[list.id] || 0,
      }));

      setLists(listsWithCounts);
    } catch (error) {
      console.error("Error fetching lists:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar suas listas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createList = async () => {
    if (!newListName.trim() || !user) return;

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("shopping_lists")
        .insert({
          name: newListName.trim(),
          user_id: user.id,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;

      setNewListName("");
      setDialogOpen(false);
      navigate(`/lista/${data.id}`);

    } catch (error) {
      console.error("Error creating list:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a lista",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  if (authLoading) {
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
    <div className="min-h-screen bg-background pb-20">
      <div className="flex items-center justify-between px-4 py-4 max-w-md mx-auto sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="-ml-2"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">Minhas Listas</h1>
            <p className="text-xs text-muted-foreground">Gerencie suas compras</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="secondary" className="text-primary h-9 w-9 rounded-xl">
                <Plus className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[90%] max-w-sm mx-auto rounded-2xl p-6">
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-center">Criar Nova Lista</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Input
                  placeholder="Ex: Compras da Semana"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="h-14 rounded-xl text-lg"
                  onKeyDown={(e) => e.key === "Enter" && createList()}
                  autoFocus
                />
                <Button
                  onClick={createList}
                  className="w-full h-14 rounded-xl text-lg font-medium"
                  disabled={!newListName.trim() || creating}
                >
                  {creating ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5 mr-2" />
                      Criar Lista
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <AppMenu />
        </div>
      </div>

      <main className="px-4 py-4 max-w-md mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : lists.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="w-10 h-10 text-primary" />}
            title="Nenhuma lista ainda"
            description="Crie sua primeira lista de compras e comece a economizar"
            action={
              <Button onClick={() => setDialogOpen(true)} className="h-12 px-6 rounded-xl">
                <Plus className="w-5 h-5 mr-2" />
                Criar Lista
              </Button>
            }
          />
        ) : (
          <div className="space-y-3 pb-4">
            {lists.map((list, index) => (
              <div key={list.id} style={{ animationDelay: `${index * 50}ms` }}>
                <ListCard
                  id={list.id}
                  name={list.name}
                  itemCount={list.item_count}
                  status={list.status}
                  createdAt={list.created_at}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
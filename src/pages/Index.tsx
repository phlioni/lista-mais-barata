import { useState, useEffect } from "react";
import { Plus, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { BottomNav } from "@/components/BottomNav";
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchLists();
    }
  }, [user]);

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

      // Fetch item counts for each list
      const listsWithCounts = await Promise.all(
        (listsData || []).map(async (list) => {
          const { count } = await supabase
            .from("list_items")
            .select("*", { count: "exact", head: true })
            .eq("list_id", list.id);

          return {
            ...list,
            item_count: count || 0,
          };
        })
      );

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
      fetchLists();
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
    <div className="min-h-screen bg-background pb-32">
      <PageHeader
        title="Minhas Listas"
        subtitle="Gerencie suas compras"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="text-primary h-10 w-10">
                <Plus className="w-6 h-6" />
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
        }
      />

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
                  status={list.status} // Passando direto a string do banco
                  createdAt={list.created_at}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
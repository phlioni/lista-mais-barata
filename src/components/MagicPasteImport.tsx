import { useState } from "react";
import { Wand2, Loader2, ArrowRight, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MagicPasteImportProps {
    listId: string;
    onSuccess: () => void;
}

export function MagicPasteImport({ listId, onSuccess }: MagicPasteImportProps) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(""); // Para mostrar o que está acontecendo
    const { toast } = useToast();

    const handleImport = async () => {
        if (!text.trim()) return;
        setLoading(true);
        setStatus("Interpretando texto com IA...");

        try {
            // 1. A IA estrutura o texto bagunçado (NÃO acessa o banco)
            const { data: aiData, error: aiError } = await supabase.functions.invoke('parse-smart-list', {
                body: { text }
            });

            if (aiError) throw aiError;
            if (!aiData.items || aiData.items.length === 0) throw new Error("Nenhum item identificado.");

            setStatus("Verificando catálogo de produtos...");

            // 2. O Banco verifica duplicidade e cria o que falta (Processamento em Lote)
            const { data: processedItems, error: dbError } = await supabase
                .rpc('match_and_create_products', {
                    items_in: aiData.items
                });

            if (dbError) throw dbError;

            setStatus("Adicionando à lista...");

            // 3. Insere os itens na lista de compras usando os IDs resolvidos
            const listItemsToInsert = (processedItems as any[]).map(item => ({
                list_id: listId,
                product_id: item.product_id,
                quantity: item.quantity,
                is_checked: false
            }));

            const { error: insertError } = await supabase
                .from('list_items')
                .insert(listItemsToInsert);

            if (insertError) throw insertError;

            toast({
                title: "Sucesso!",
                description: `${listItemsToInsert.length} itens organizados e adicionados.`,
            });

            setOpen(false);
            setText("");
            onSuccess();

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Erro ao importar",
                description: error.message || "Não foi possível processar a lista.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
            setStatus("");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="secondary" className="gap-2 w-full sm:w-auto bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200">
                    <Wand2 className="w-4 h-4" />
                    Colar do WhatsApp
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardPaste className="w-5 h-5 text-indigo-600" />
                        Importação Mágica
                    </DialogTitle>
                    <DialogDescription>
                        Cole sua lista abaixo. Nós verificamos se os produtos já existem no catálogo para não criar duplicados.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <Textarea
                        placeholder="Ex: 2 arroz, feijão, 3 detergentes e picanha..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="min-h-[150px] text-base"
                    />
                </div>

                <DialogFooter>
                    <Button onClick={handleImport} disabled={loading || !text.trim()} className="w-full sm:w-auto">
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {status || "Processando..."}
                            </>
                        ) : (
                            <>
                                Importar e Organizar
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
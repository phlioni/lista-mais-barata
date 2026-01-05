import { useState } from "react";
import { Check, AlertTriangle, Plus, X, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Tipos baseados na resposta da IA
export interface ScanResult {
    matched: Array<{ list_item_id: string; receipt_name: string; price: number; confidence: string }>;
    new_items: Array<{ name: string; price: number; quantity: number }>;
    review_needed: Array<{ list_item_id: string; receipt_name: string; reason: string; price: number }>;
}

interface ReceiptReconciliationProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    scanResult: ScanResult | null;
    currentItems: Array<{ id: string; name: string; brand: string | null }>;
    onConfirm: (data: {
        updates: Array<{ itemId: string; price: number }>;
        newItems: Array<{ name: string; price: number; quantity: number }>;
    }) => void;
}

export function ReceiptReconciliation({
    open,
    onOpenChange,
    scanResult,
    currentItems,
    onConfirm
}: ReceiptReconciliationProps) {
    const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
    const [selectedNewItems, setSelectedNewItems] = useState<Set<number>>(new Set()); // index based
    const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set()); // list_item_id based

    // Inicializa seleções quando o resultado chega
    useState(() => {
        if (scanResult) {
            // Por padrão, seleciona todos os matches de alta confiança e novos itens
            const matches = new Set(scanResult.matched.map(m => m.list_item_id));
            const newItems = new Set(scanResult.new_items.map((_, i) => i));
            setSelectedMatches(matches);
            setSelectedNewItems(newItems);
            // Reviews começam desmarcados por segurança
        }
    });

    if (!scanResult) return null;

    const handleConfirm = () => {
        const updates: Array<{ itemId: string; price: number }> = [];
        const newItemsToAdd: Array<{ name: string; price: number; quantity: number }> = [];

        // Adiciona Matches confirmados
        scanResult.matched.forEach(item => {
            if (selectedMatches.has(item.list_item_id)) {
                updates.push({ itemId: item.list_item_id, price: item.price });
            }
        });

        // Adiciona Reviews confirmados (substituições)
        scanResult.review_needed.forEach(item => {
            if (selectedReviews.has(item.list_item_id)) {
                updates.push({ itemId: item.list_item_id, price: item.price });
            }
        });

        // Adiciona Novos itens
        scanResult.new_items.forEach((item, index) => {
            if (selectedNewItems.has(index)) {
                newItemsToAdd.push(item);
            }
        });

        onConfirm({ updates, newItems: newItemsToAdd });
        onOpenChange(false);
    };

    const getItemName = (id: string) => {
        const item = currentItems.find(i => i.id === id);
        return item ? `${item.name} ${item.brand || ''}` : 'Item desconhecido';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[95%] h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>Leitura da Nota</DialogTitle>
                    <DialogDescription>
                        Confira os itens identificados antes de salvar.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 px-6">
                    <div className="space-y-6 pb-6">

                        {/* MATCHES PERFEITOS */}
                        {scanResult.matched.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" /> Confirmados ({scanResult.matched.length})
                                </h3>
                                <div className="space-y-2">
                                    {scanResult.matched.map((item) => (
                                        <div key={item.list_item_id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <Checkbox
                                                    checked={selectedMatches.has(item.list_item_id)}
                                                    onCheckedChange={(c) => {
                                                        const next = new Set(selectedMatches);
                                                        c ? next.add(item.list_item_id) : next.delete(item.list_item_id);
                                                        setSelectedMatches(next);
                                                    }}
                                                />
                                                <div className="min-w-0">
                                                    <p className="font-medium truncate text-sm">{getItemName(item.list_item_id)}</p>
                                                    <p className="text-xs text-muted-foreground truncate">Nota: {item.receipt_name}</p>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="ml-2 bg-background">
                                                R$ {item.price.toFixed(2)}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ITENS QUE PRECISAM DE ATENÇÃO (Substituições?) */}
                        {scanResult.review_needed.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-orange-600 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> Atenção Necessária ({scanResult.review_needed.length})
                                </h3>
                                {scanResult.review_needed.map((item) => (
                                    <div key={item.list_item_id} className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Checkbox
                                                checked={selectedReviews.has(item.list_item_id)}
                                                onCheckedChange={(c) => {
                                                    const next = new Set(selectedReviews);
                                                    c ? next.add(item.list_item_id) : next.delete(item.list_item_id);
                                                    setSelectedReviews(next);
                                                }}
                                            />
                                            <p className="text-sm font-medium">Aceitar substituição?</p>
                                        </div>

                                        <div className="flex items-center justify-between text-sm pl-7">
                                            <div className="space-y-1 flex-1">
                                                <p className="text-muted-foreground line-through text-xs">{getItemName(item.list_item_id)}</p>
                                                <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                                                    <ArrowRight className="w-3 h-3" />
                                                    <span className="font-medium">{item.receipt_name}</span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">{item.reason}</p>
                                            </div>
                                            <Badge variant="secondary">R$ {item.price.toFixed(2)}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* NOVOS ITENS NA NOTA */}
                        {scanResult.new_items.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-blue-600 flex items-center gap-2">
                                    <Plus className="w-4 h-4" /> Novos Itens ({scanResult.new_items.length})
                                </h3>
                                <div className="space-y-2">
                                    {scanResult.new_items.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-blue-50/50 dark:bg-blue-950/10 rounded-lg border border-blue-100 dark:border-blue-900">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <Checkbox
                                                    checked={selectedNewItems.has(idx)}
                                                    onCheckedChange={(c) => {
                                                        const next = new Set(selectedNewItems);
                                                        c ? next.add(idx) : next.delete(idx);
                                                        setSelectedNewItems(next);
                                                    }}
                                                />
                                                <div className="min-w-0">
                                                    <p className="font-medium truncate text-sm">{item.name}</p>
                                                    <p className="text-xs text-muted-foreground">Novo item detectado</p>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="bg-background">
                                                R$ {item.price.toFixed(2)}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </ScrollArea>

                <div className="p-4 border-t bg-background space-y-3">
                    <div className="flex justify-between text-sm font-medium">
                        <span>Total Confirmado</span>
                        <span>
                            R$ {
                                ([...Array.from(selectedMatches).map(id => scanResult.matched.find(m => m.list_item_id === id)?.price || 0),
                                ...Array.from(selectedReviews).map(id => scanResult.review_needed.find(r => r.list_item_id === id)?.price || 0),
                                ...Array.from(selectedNewItems).map(idx => scanResult.new_items[idx]?.price || 0)
                                ].reduce((a, b) => a + b, 0)).toFixed(2)
                            }
                        </span>
                    </div>
                    <Button onClick={handleConfirm} className="w-full h-12 text-base rounded-xl">
                        Confirmar e Atualizar Lista
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
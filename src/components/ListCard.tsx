import { Calendar, CheckCircle2, ChevronRight, ShoppingCart, CircleDashed, PlayCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ListCardProps {
  id: string;
  name: string;
  itemCount: number;
  status: string; // Alterado para string para aceitar qualquer status do banco
  createdAt: string;
}

export function ListCard({ id, name, itemCount, status, createdAt }: ListCardProps) {
  const isClosed = status === "closed";
  const isShopping = status === "shopping"; // Status "Em andamento"

  return (
    <Link
      to={`/lista/${id}`}
      className={cn(
        "group relative flex items-center justify-between p-4 bg-card rounded-2xl border transition-all duration-200",
        isShopping
          ? "border-primary shadow-md shadow-primary/10 ring-1 ring-primary/20" // Destaque para Em Andamento
          : isClosed
            ? "border-border/50 bg-muted/20" // Visual apagado para Fechada
            : "border-border shadow-soft hover:shadow-card hover:-translate-y-0.5" // Padrão para Aberta
      )}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-colors flex-shrink-0",
            isClosed
              ? "bg-muted text-muted-foreground"
              : isShopping
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-primary/10 text-primary"
          )}
        >
          {isClosed ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : isShopping ? (
            <ShoppingCart className="w-6 h-6 animate-pulse" />
          ) : (
            <CircleDashed className="w-6 h-6" />
          )}
        </div>
        <div className="min-w-0">
          <h3 className={cn(
            "font-semibold text-base truncate pr-2 transition-all",
            isClosed ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground"
          )}>
            {name}
          </h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className={cn("font-medium", isShopping && "text-primary font-bold")}>
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
            <span className="flex items-center gap-1 truncate">
              <Calendar className="w-3 h-3" />
              {new Date(createdAt).toLocaleDateString("pt-BR")}
            </span>
          </div>

          {/* Badge explícito para Em Andamento */}
          {isShopping && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                Em andamento
              </p>
            </div>
          )}
        </div>
      </div>

      <ChevronRight className={cn(
        "w-5 h-5 transition-transform duration-200 group-hover:translate-x-1",
        isShopping ? "text-primary" : "text-muted-foreground/50"
      )} />
    </Link>
  );
}
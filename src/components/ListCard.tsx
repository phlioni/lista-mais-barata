import { ShoppingBag, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ListCardProps {
  id: string;
  name: string;
  itemCount: number;
  status: "open" | "closed";
  createdAt: string;
}

export function ListCard({ id, name, itemCount, status, createdAt }: ListCardProps) {
  const isOpen = status === "open";
  
  return (
    <Link
      to={`/lista/${id}`}
      className="block animate-fade-in"
    >
      <div className={cn(
        "flex items-center gap-4 p-4 bg-card rounded-2xl border border-border shadow-soft",
        "transition-all duration-200 hover:shadow-card hover:border-primary/20",
        "active:scale-[0.98]"
      )}>
        <div className={cn(
          "flex items-center justify-center w-12 h-12 rounded-xl",
          isOpen ? "bg-accent" : "bg-muted"
        )}>
          <ShoppingBag className={cn(
            "w-6 h-6",
            isOpen ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{name}</h3>
          <p className="text-sm text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {isOpen ? (
            <span className="px-2 py-1 text-xs font-medium bg-accent text-accent-foreground rounded-full">
              Aberta
            </span>
          ) : (
            <span className="px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
              Fechada
            </span>
          )}
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}

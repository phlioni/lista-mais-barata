import { Link, useLocation } from "react-router-dom";
import { ShoppingCart, MapPin, User, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", icon: Trophy, label: "Início" }, // Gamificação (Home)
  { path: "/listas", icon: ShoppingCart, label: "Listas" }, 
  { path: "/comunidade", icon: Users, label: "Comunidade" },
  { path: "/mercados", icon: MapPin, label: "Mercados" },
  { path: "/perfil", icon: User, label: "Perfil" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-lg border-t border-border safe-bottom pb-safe shadow-[0_-5px_10px_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full rounded-xl transition-all duration-200 active:scale-95",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all duration-200 relative",
                isActive && "bg-primary/10"
              )}>
                <Icon className={cn(
                  "w-6 h-6 transition-transform duration-200",
                  isActive && "scale-105"
                )} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                isActive ? "font-bold" : "font-normal"
              )}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
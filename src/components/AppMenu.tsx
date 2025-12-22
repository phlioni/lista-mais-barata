import { Home, ShoppingCart, MapPin, User, Menu, LogOut } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export function AppMenu() {
    const location = useLocation();
    const { signOut } = useAuth();

    const menuItems = [
        { path: "/", icon: ShoppingCart, label: "Minhas Listas" },
        { path: "/mercados", icon: MapPin, label: "Mercados" },
        { path: "/perfil", icon: User, label: "Perfil" },
    ];

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 -mr-2">
                    <Menu className="w-6 h-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader className="mb-6 text-left">
                    <SheetTitle className="flex items-center gap-2 text-xl font-display">
                        <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-primary-foreground" />
                        </span>
                        Lista Certa
                    </SheetTitle>
                </SheetHeader>

                <nav className="flex flex-col gap-2">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                                    isActive
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                )}
                            >
                                <Icon className={cn("w-5 h-5", isActive && "text-primary")} />
                                {item.label}
                            </Link>
                        );
                    })}

                    <div className="my-2 border-t border-border/50" />

                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-all duration-200 w-full text-left"
                    >
                        <LogOut className="w-5 h-5" />
                        Sair da conta
                    </button>
                </nav>
            </SheetContent>
        </Sheet>
    );
}
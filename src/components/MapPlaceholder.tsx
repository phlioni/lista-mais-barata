import { MapPin } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface MapPlaceholderProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation?: { lat: number; lng: number } | null;
}

export function MapPlaceholder({ onLocationSelect, selectedLocation }: MapPlaceholderProps) {
  const [isHovering, setIsHovering] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert click position to fake lat/lng (São Paulo area simulation)
    const lat = -23.5505 + ((y / rect.height) - 0.5) * 0.1;
    const lng = -46.6333 + ((x / rect.width) - 0.5) * 0.2;
    
    onLocationSelect(lat, lng);
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        "relative w-full h-64 rounded-2xl overflow-hidden cursor-crosshair",
        "bg-gradient-to-br from-accent via-muted to-secondary",
        "border-2 border-dashed border-border transition-all duration-200",
        isHovering && "border-primary/50"
      )}
    >
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-foreground/30"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      
      {/* Center text */}
      {!selectedLocation && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
          <MapPin className="w-8 h-8 mb-2" />
          <p className="text-sm font-medium">Clique para selecionar a localização</p>
          <p className="text-xs mt-1">(Simulação de mapa)</p>
        </div>
      )}
      
      {/* Selected marker */}
      {selectedLocation && (
        <div 
          className="absolute animate-bounce-gentle"
          style={{
            left: `${50 + (selectedLocation.lng + 46.6333) * 500}%`,
            top: `${50 + (selectedLocation.lat + 23.5505) * 1000}%`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="relative">
            <MapPin className="w-8 h-8 text-primary drop-shadow-lg" fill="hsl(var(--primary))" />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary/30 rounded-full animate-ping" />
          </div>
        </div>
      )}
      
      {/* Instructions */}
      <div className="absolute bottom-3 left-3 right-3 bg-card/90 backdrop-blur-sm rounded-lg p-2 text-xs text-muted-foreground">
        <p>💡 Configure a API do Google Maps para usar o mapa real</p>
      </div>
    </div>
  );
}

// src/components/MapSelector.tsx
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Correção dos ícones
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapSelectorProps {
    // Tornamos opcional pois no modo leitura não precisamos passar função
    onLocationSelect?: (lat: number, lng: number) => void;
    selectedLocation?: { lat: number; lng: number } | null;
    className?: string;
    readOnly?: boolean; // Nova propriedade
}

function MapEvents({
    onSelect,
    selectedLocation
}: {
    onSelect?: (lat: number, lng: number) => void,
    selectedLocation?: { lat: number; lng: number } | null
}) {
    const map = useMap();

    useMapEvents({
        click(e) {
            if (onSelect) {
                onSelect(e.latlng.lat, e.latlng.lng);
            }
        },
    });

    useEffect(() => {
        if (selectedLocation) {
            map.flyTo([selectedLocation.lat, selectedLocation.lng], map.getZoom());
        }
    }, [selectedLocation, map]);

    return null;
}

export function MapSelector({ onLocationSelect, selectedLocation, className, readOnly = false }: MapSelectorProps) {
    const [initialPosition, setInitialPosition] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        // Se já tiver uma localização selecionada (modo edição/visualização), usa ela como inicial
        if (selectedLocation) {
            setInitialPosition(selectedLocation);
            return;
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setInitialPosition({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                () => {
                    setInitialPosition({ lat: -23.5505, lng: -46.6333 });
                }
            );
        } else {
            setInitialPosition({ lat: -23.5505, lng: -46.6333 });
        }
    }, []); // Removemos selectedLocation das dependências para evitar re-render loops na inicialização

    if (!initialPosition) {
        return (
            <div className={cn(
                "flex items-center justify-center bg-accent rounded-2xl border border-border",
                className || "h-64"
            )}>
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Carregando mapa...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("rounded-2xl overflow-hidden border border-border isolate z-0", className || "h-64")}>
            <MapContainer
                center={[initialPosition.lat, initialPosition.lng]}
                zoom={15}
                style={{ width: "100%", height: "100%" }}
                className="z-0"
                dragging={!readOnly} // Desativa arrastar se for readOnly (opcional, pode deixar true se preferir)
                scrollWheelZoom={!readOnly} // Evita zoom acidental ao rolar a página
                doubleClickZoom={!readOnly}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Só adiciona eventos de clique se NÃO for readOnly */}
                {!readOnly && (
                    <MapEvents onSelect={onLocationSelect} selectedLocation={selectedLocation} />
                )}

                {/* Se for readOnly e tiver location, centraliza o mapa nela ao carregar */}
                {readOnly && selectedLocation && (
                    <Marker position={[selectedLocation.lat, selectedLocation.lng]} />
                )}

                {!readOnly && selectedLocation && (
                    <Marker position={[selectedLocation.lat, selectedLocation.lng]} />
                )}
            </MapContainer>
        </div>
    );
}
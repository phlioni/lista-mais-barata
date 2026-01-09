import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Correção dos ícones do Leaflet
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
    onLocationSelect?: (lat: number, lng: number) => void;
    selectedLocation?: { lat: number; lng: number } | null;
    className?: string;
    readOnly?: boolean;
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
    }, []);

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
        <div
            className={cn(
                "rounded-2xl overflow-hidden border border-border relative z-0",
                className || "h-64"
            )}
            // FIX PARA SAFARI/IPHONE: Força o navegador a reconhecer o recorte (clipping)
            style={{
                WebkitMaskImage: "-webkit-radial-gradient(white, black)",
                maskImage: "radial-gradient(white, black)",
                isolation: "isolate"
            }}
        >
            <MapContainer
                center={[initialPosition.lat, initialPosition.lng]}
                zoom={15}
                style={{ width: "100%", height: "100%" }}
                className="z-[1]" // Garante que o canvas do mapa fique acima do fundo
                dragging={!readOnly}
                scrollWheelZoom={!readOnly}
                doubleClickZoom={!readOnly}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {!readOnly && (
                    <MapEvents onSelect={onLocationSelect} selectedLocation={selectedLocation} />
                )}

                {selectedLocation && (
                    <Marker position={[selectedLocation.lat, selectedLocation.lng]} />
                )}
            </MapContainer>
        </div>
    );
}
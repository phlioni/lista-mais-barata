import { useEffect, useState, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { cn } from "@/lib/utils";
import { Loader2, MapPin } from "lucide-react";

// Usa a mesma chave de API configurada no .env
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";

interface MapSelectorProps {
    onLocationSelect?: (lat: number, lng: number) => void;
    selectedLocation?: { lat: number; lng: number } | null;
    className?: string;
    readOnly?: boolean;
}

export function MapSelector({ onLocationSelect, selectedLocation, className, readOnly = false }: MapSelectorProps) {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script', // <--- FIX: Padronizado com o mesmo ID das outras telas
        googleMapsApiKey: apiKey
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);

    const hasCenteredRef = useRef(false);

    useEffect(() => {
        if (selectedLocation) {
            setCenter(selectedLocation);
            return;
        }

        if (!hasCenteredRef.current) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setCenter({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        });
                        hasCenteredRef.current = true;
                    },
                    () => {
                        setCenter({ lat: -23.5505, lng: -46.6333 });
                        hasCenteredRef.current = true;
                    }
                );
            } else {
                setCenter({ lat: -23.5505, lng: -46.6333 });
                hasCenteredRef.current = true;
            }
        }
    }, [selectedLocation]);

    useEffect(() => {
        if (map && selectedLocation) {
            map.panTo(selectedLocation);
        }
    }, [map, selectedLocation]);

    const onLoad = useCallback((map: google.maps.Map) => {
        setMap(map);
    }, []);

    const onUnmount = useCallback(() => {
        setMap(null);
    }, []);

    const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (readOnly || !onLocationSelect || !e.latLng) return;

        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        onLocationSelect(lat, lng);
    }, [readOnly, onLocationSelect]);

    if (loadError) {
        return (
            <div className={cn("flex flex-col items-center justify-center bg-muted rounded-2xl border border-border text-center p-4", className || "h-64")}>
                <p className="text-sm font-bold text-destructive mb-1">Erro no Google Maps</p>
                <p className="text-xs text-muted-foreground">Verifique sua chave de API.</p>
            </div>
        );
    }

    if (!isLoaded || !center) {
        return (
            <div className={cn("flex items-center justify-center bg-muted rounded-2xl border border-border", className || "h-64")}>
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Carregando mapa...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("rounded-2xl overflow-hidden border border-border relative z-0", className || "h-64")}>
            <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={center}
                zoom={15}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onClick={handleMapClick}
                options={{
                    disableDefaultUI: readOnly,
                    zoomControl: !readOnly,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    clickableIcons: !readOnly,
                    gestureHandling: "greedy",
                }}
            >
                {selectedLocation && (
                    <Marker position={selectedLocation} />
                )}
            </GoogleMap>

            {!readOnly && !selectedLocation && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 opacity-50">
                    <MapPin className="w-8 h-8 text-primary animate-bounce" />
                </div>
            )}
        </div>
    );
}
import { useCallback, useState, useEffect } from "react";
import { GoogleMap as GoogleMapComponent, useLoadScript, Marker } from "@react-google-maps/api";
import { MapPin, Loader2 } from "lucide-react";
import { GOOGLE_MAPS_API_KEY, defaultMapCenter, defaultMapZoom, mapContainerStyle, mapOptions } from "@/lib/googleMapsConfig";
import { cn } from "@/lib/utils";

interface GoogleMapProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation?: { lat: number; lng: number } | null;
  className?: string;
}

export function GoogleMap({ onLocationSelect, selectedLocation, className }: GoogleMapProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Try to get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // If user denies location, use default (São Paulo)
          setUserLocation(defaultMapCenter);
        }
      );
    } else {
      setUserLocation(defaultMapCenter);
    }
  }, []);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        onLocationSelect(e.latLng.lat(), e.latLng.lng());
      }
    },
    [onLocationSelect]
  );

  if (loadError) {
    return (
      <div className={cn(
        "flex items-center justify-center bg-destructive/10 rounded-2xl border border-destructive/30",
        className || "h-64"
      )}>
        <div className="text-center p-4">
          <MapPin className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive">Erro ao carregar o mapa</p>
          <p className="text-xs text-muted-foreground mt-1">Verifique sua conexão</p>
        </div>
      </div>
    );
  }

  if (!isLoaded || !userLocation) {
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
    <div className={cn("rounded-2xl overflow-hidden border border-border", className || "h-64")}>
      <GoogleMapComponent
        mapContainerStyle={mapContainerStyle}
        center={selectedLocation || userLocation}
        zoom={defaultMapZoom}
        onClick={handleMapClick}
        options={mapOptions}
      >
        {selectedLocation && (
          <Marker
            position={selectedLocation}
            animation={google.maps.Animation.DROP}
          />
        )}
      </GoogleMapComponent>
    </div>
  );
}

import { GoogleMap } from "./GoogleMap";

interface MapPlaceholderProps {
  onLocationSelect: (lat: number, lng: number) => void;
  selectedLocation?: { lat: number; lng: number } | null;
}

// This component now wraps the real Google Maps component
export function MapPlaceholder({ onLocationSelect, selectedLocation }: MapPlaceholderProps) {
  return (
    <GoogleMap
      onLocationSelect={onLocationSelect}
      selectedLocation={selectedLocation}
      className="h-64"
    />
  );
}

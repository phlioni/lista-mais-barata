// Google Maps API Configuration
export const GOOGLE_MAPS_API_KEY = "AIzaSyCjrE0DA_MpxwPEsapcAcN5iMIwWUv2pTE";

export const defaultMapCenter = {
  lat: -23.5505, // São Paulo
  lng: -46.6333,
};

export const defaultMapZoom = 13;

export const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

export const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  styles: [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
  ],
};

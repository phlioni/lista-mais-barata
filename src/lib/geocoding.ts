import { GOOGLE_MAPS_API_KEY } from "@/lib/googleMapsConfig";

export async function getAddressFromCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=pt-BR`
    );
    
    if (!response.ok) {
      console.error("Geocoding API error:", response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.status === "OK" && data.results.length > 0) {
      // Try to get a shorter, more readable address
      const result = data.results[0];
      
      // Look for street address first
      const streetAddress = data.results.find(
        (r: any) => r.types.includes("street_address") || r.types.includes("route")
      );
      
      if (streetAddress) {
        return streetAddress.formatted_address;
      }
      
      return result.formatted_address;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting address:", error);
    return null;
  }
}

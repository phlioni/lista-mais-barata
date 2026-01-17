// src/lib/geocoding.ts

export async function getAddressFromCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ListaMaisBarataApp/1.0',
          'Accept-Language': 'pt-BR' // Força o retorno em português
        }
      }
    );

    if (!response.ok) {
      console.error("Geocoding API error:", response.status);
      return null;
    }

    const data = await response.json();

    if (data && data.address) {
      const addr = data.address;

      // Mapeia os campos retornados pelo Nominatim
      // O Nominatim usa chaves diferentes dependendo do tipo da via (road, pedestrian, street, etc)
      const street = addr.road || addr.street || addr.pedestrian || addr.footway || '';

      // O número só vem se o OpenStreetMap tiver esse dado cadastrado no ponto exato
      const number = addr.house_number || '';

      const neighborhood = addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || '';
      const city = addr.city || addr.town || addr.municipality || addr.village || '';

      // Tenta pegar a sigla do estado (ex: SP) se disponível, senão pega o nome completo
      // O Nominatim as vezes retorna ISO3166-2-lvl4 como "BR-SP"
      let state = addr.state || '';
      if (addr["ISO3166-2-lvl4"]) {
        state = addr["ISO3166-2-lvl4"].split('-')[1] || state;
      }

      // Monta o array na ordem desejada: Rua, Numero, Bairro, Cidade, Estado
      const parts = [];

      if (street) parts.push(street);
      if (number) parts.push(number);
      if (neighborhood) parts.push(neighborhood);
      if (city) parts.push(city);
      if (state) parts.push(state);

      // Junta com vírgula e espaço
      const formattedAddress = parts.join(', ');

      // Se não conseguiu montar nada (ex: clicou no meio do oceano), retorna o display_name como fallback
      return formattedAddress || data.display_name;
    }

    return null;
  } catch (error) {
    console.error("Error getting address:", error);
    return null;
  }
}

export async function checkLocationEligibility(lat: number, lng: number): Promise<{ eligible: boolean; city: string }> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ListaMaisBarataApp/1.0',
          'Accept-Language': 'pt-BR'
        }
      }
    );

    if (!response.ok) return { eligible: false, city: 'Desconhecida' };

    const data = await response.json();

    if (data && data.address) {
      // Normaliza o nome da cidade para comparação
      const city = data.address.city || data.address.town || data.address.municipality || 'Desconhecida';
      const cleanCity = city.toLowerCase().trim();

      const isSantos = cleanCity === 'santos';
      const isSaoVicente = cleanCity === 'são vicente' || cleanCity === 'sao vicente';

      return {
        eligible: isSantos || isSaoVicente,
        city: city
      };
    }

    return { eligible: false, city: 'Desconhecida' };
  } catch (error) {
    console.error("Error checking eligibility:", error);
    return { eligible: false, city: 'Erro' };
  }
}
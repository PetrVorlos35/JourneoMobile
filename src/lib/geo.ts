import { useEffect, useRef, useState } from 'react';

import { geoApi, type GeoPlace } from '@/lib/api';
import { currentLanguage } from '@/lib/i18n';

// Našeptávač míst přes /geo (server se ptá Nominatimu, max 1 dotaz za sekundu),
// proto se hledá až po pauze v psaní a od 3 znaků.
export function useGeoSuggestions(query: string, enabled: boolean) {
  const [found, setFound] = useState<GeoPlace[]>([]);
  const [failed, setFailed] = useState(false);
  const q = query.trim();
  const searching = enabled && q.length >= 3;
  const requestId = useRef(0);

  useEffect(() => {
    if (!searching) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const { results } = await geoApi.search(q, currentLanguage());
        if (id === requestId.current) {
          setFound(results);
          setFailed(false);
        }
      } catch {
        if (id === requestId.current) setFailed(true);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [q, searching]);

  return { results: searching ? found : [], failed: searching && failed };
}

// „Praha, Česko“ → druhá část adresy pod názvem návrhu.
export const placeArea = (place: GeoPlace) => (place.address ?? '').split(', ').slice(1).join(', ');
